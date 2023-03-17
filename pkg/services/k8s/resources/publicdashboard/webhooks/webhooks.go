package webhooks

import (
	"context"

	. "github.com/grafana/grafana/pkg/services/k8s/resources/publicdashboard"
	k8sTypes "k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	k8sAdmission "k8s.io/api/admission/v1"
	admissionregistrationV1 "k8s.io/api/admissionregistration/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type WebhooksAPI struct {
	RouteRegister        routing.RouteRegister
	AccessControl        accesscontrol.AccessControl
	Features             *featuremgmt.FeatureManager
	Log                  log.Logger
	ValidationController admission.ValidatingAdmissionController
	MutationController   admission.MutatingAdmissionController
}

var ValidationWebhookConfigs = []client.ShortWebhookConfig{
	{
		Kind:       Kind,
		Operations: []admissionregistrationV1.OperationType{admissionregistrationV1.Create},
		Url:        "https://host.docker.internal:3443/k8s/publicdashboards/admission/create",
		Timeout:    int32(5),
	},
}

var MutationWebhookConfigs = []client.ShortWebhookConfig{
	{
		Kind:       Kind,
		Operations: []admissionregistrationV1.OperationType{admissionregistrationV1.Create},
		Url:        "https://host.docker.internal:3443/k8s/publicdashboards/mutation/create",
		Timeout:    int32(5),
	},
}

func ProvideWebhooks(
	rr routing.RouteRegister,
	clientset *client.Clientset,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
	vc admission.ValidatingAdmissionController,
	mc admission.MutatingAdmissionController,
) *WebhooksAPI {
	webhooksAPI := &WebhooksAPI{
		RouteRegister:        rr,
		AccessControl:        ac,
		Log:                  log.New("k8s.publicdashboard.webhooks"),
		ValidationController: vc,
		MutationController:   mc,
	}

	// Register webhooks on grafana api server
	webhooksAPI.RegisterAPIEndpoints()

	// Register admission hooks with k8s api server
	err := clientset.RegisterValidation(context.Background(), ValidationWebhookConfigs)
	if err != nil {
		panic(err)
	}

	// Register mutation hooks with k8s api server
	err = clientset.RegisterMutation(context.Background(), MutationWebhookConfigs)
	if err != nil {
		panic(err)
	}

	return webhooksAPI
}

func (api *WebhooksAPI) RegisterAPIEndpoints() {
	api.RouteRegister.Post("/k8s/publicdashboards/admission/create", api.AdmissionCreate)
	api.RouteRegister.Post("/k8s/publicdashboards/mutation/create", api.MutationCreate)
}

func makeSuccessfulAdmissionReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:     uid,
			Allowed: true,
			Result: &metaV1.Status{
				Status: "Success",
				Code:   200,
			},
		},
	}
}

func makeFailureAdmissionReview(uid k8sTypes.UID, typeMeta metaV1.TypeMeta, err error, code int32) *k8sAdmission.AdmissionReview {
	return &k8sAdmission.AdmissionReview{
		TypeMeta: typeMeta,
		Response: &k8sAdmission.AdmissionResponse{
			UID:     uid,
			Allowed: false,
			Result: &metaV1.Status{
				Status:  "Failure",
				Message: err.Error(),
				Code:    code,
			},
		},
	}
}