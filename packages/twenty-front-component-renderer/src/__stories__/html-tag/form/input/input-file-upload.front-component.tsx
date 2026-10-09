import { type ChangeEvent, useState } from 'react';
import { uploadFile, type UploadFileResult } from 'twenty-sdk/front-component';
import { defineFrontComponent } from 'twenty-sdk/define';

import { FrontComponentCard } from '@/__stories__/shared/front-components/front-component-card';
import { readFileContent } from '@/__stories__/shared/front-components/readFileContent';
import {
  LABEL_STYLE,
  SUBJECT_WRAPPER_STYLE,
} from '@/__stories__/shared/front-components/styles';

const FILES_FIELD_METADATA_ID = '11111111-1111-4111-8111-111111111111';

type UploadOutcome = {
  name: string;
  text: string;
  bytes: number[];
  result: UploadFileResult | { status: 'threw'; message: string };
};

const InputFileUploadFrontComponent = () => {
  const [uploads, setUploads] = useState<UploadOutcome[]>([]);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);

    setUploads(
      await Promise.all(
        files.map(async (file) => {
          const content = await readFileContent(file);

          try {
            return {
              name: content.name,
              text: content.text,
              bytes: content.bytes,
              result: await uploadFile(file, {
                fieldMetadataId: FILES_FIELD_METADATA_ID,
                fileName: file.name,
              }),
            };
          } catch (error) {
            return {
              name: content.name,
              text: content.text,
              bytes: content.bytes,
              result: {
                status: 'threw' as const,
                message: error instanceof Error ? error.message : String(error),
              },
            };
          }
        }),
      ),
    );
  };

  return (
    <FrontComponentCard title="input:file:upload">
      <div style={SUBJECT_WRAPPER_STYLE}>
        <label style={LABEL_STYLE}>Upload files</label>
        <input
          data-testid="subject"
          type="file"
          multiple
          onChange={handleChange}
        />
      </div>
      <div data-testid="upload-results">{JSON.stringify(uploads)}</div>
    </FrontComponentCard>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    'fc-input-file-upload-00000000-0000-0000-0000-000000000021',
  name: 'input-file-upload-front-component',
  description: 'Front component demonstrating SDK uploadFile with local files',
  component: InputFileUploadFrontComponent,
});
