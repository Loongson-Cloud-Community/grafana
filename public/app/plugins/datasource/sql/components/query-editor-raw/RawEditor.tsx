import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, useStyles2, useTheme2 } from '@grafana/ui';

import { SQLQuery, QueryEditorProps } from '../../types';
import { getColumnInfoFromSchema } from '../../utils/fields';

import { QueryEditorRaw } from './QueryEditorRaw';
import { QueryToolbox } from './QueryToolbox';

interface RawEditorProps extends Omit<QueryEditorProps, 'onChange'> {
  onRunQuery: () => void;
  onChange: (q: SQLQuery, processQuery: boolean) => void;
  onValidate: (isValid: boolean) => void;
  queryToValidate: SQLQuery;
}

export function RawEditor({ db, query, onChange, onRunQuery, onValidate, queryToValidate, range }: RawEditorProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toolboxRef, toolboxMeasure] = useMeasure<HTMLDivElement>();
  const [editorRef, editorMeasure] = useMeasure<HTMLDivElement>();

  const getColumns = useCallback(
    // expects fully qualified table name: <project-id>.<dataset-id>.<table-id>
    async (t: string) => {
      if (!db) {
        return [];
      }
      let cols;
      // const tablePath = t.split('.');

      cols = await db.fields(t);

      // move to DB impl of "fields" - big query would have this logic
      // if (tablePath.length === 3) {
      //   cols = await db.fields(t);
      // } else {
      //   if (!query.dataset) {
      //     return [];
      //   }
      //   cols = await apiClient.getColumns({ ...query, table: t, project: tablePath[0] });
      // }

      if (cols.length > 0) {
        const schema = await db.tableSchema(t);
        // const schema = await apiClient.getTableSchema({
        //   ...query,
        //   dataset: tablePath[1],
        //   table: tablePath[2],
        //   project: tablePath[0],
        // });
        return cols.map((c) => {
          const cInfo = schema.schema ? getColumnInfoFromSchema(c, schema.schema) : null;
          return { name: c, ...cInfo };
        });
      } else {
        return [];
      }
    },
    [db]
  );

  const getTables = useCallback(
    async (p?: string) => {
      if (!db) {
        return [];
      }

      return db.lookup(p);
    },
    [db]
  );

  const getTableSchema = useCallback(
    async (path: string) => {
      if (!db) {
        return null;
      }

      return db.tableSchema(path);
    },
    [db]
  );

  const renderQueryEditor = (width?: number, height?: number) => {
    return (
      <QueryEditorRaw
        getTables={getTables}
        getColumns={getColumns}
        getTableSchema={getTableSchema}
        query={query}
        width={width}
        height={height ? height - toolboxMeasure.height : undefined}
        onChange={onChange}
      >
        {({ formatQuery }) => {
          return (
            <div ref={toolboxRef}>
              <QueryToolbox
                db={db}
                query={queryToValidate}
                onValidate={onValidate}
                onFormatCode={formatQuery}
                showTools
                range={range}
                onExpand={setIsExpanded}
                isExpanded={isExpanded}
              />
            </div>
          );
        }}
      </QueryEditorRaw>
    );
  };

  const renderEditor = (standalone = false) => {
    return standalone ? (
      <AutoSizer>
        {({ width, height }) => {
          return renderQueryEditor(width, height);
        }}
      </AutoSizer>
    ) : (
      <div ref={editorRef}>{renderQueryEditor()}</div>
    );
  };

  const renderPlaceholder = () => {
    return (
      <div
        style={{
          width: editorMeasure.width,
          height: editorMeasure.height,
          background: theme.colors.background.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Editing in expanded code editor
      </div>
    );
  };

  return (
    <>
      {isExpanded ? renderPlaceholder() : renderEditor()}
      {isExpanded && (
        <Modal
          title={`Query ${query.refId}`}
          closeOnBackdropClick={false}
          closeOnEscape={false}
          className={styles.modal}
          contentClassName={styles.modalContent}
          isOpen={isExpanded}
          onDismiss={() => {
            setIsExpanded(false);
          }}
        >
          {renderEditor(true)}
        </Modal>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css`
      width: 95vw;
      height: 95vh;
    `,
    modalContent: css`
      height: 100%;
      padding-top: 0;
    `,
  };
}
