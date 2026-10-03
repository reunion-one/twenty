import { type ChangeEvent, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';

import {
  EventLog,
  useEventLog,
} from '@/__stories__/shared/front-components/event-log';
import { FrontComponentCard } from '@/__stories__/shared/front-components/front-component-card';
import {
  readFileContent,
  type ReadFileContent,
} from '@/__stories__/shared/front-components/readFileContent';
import {
  LABEL_STYLE,
  SUBJECT_WRAPPER_STYLE,
} from '@/__stories__/shared/front-components/styles';

type FileSelectionContent = {
  currentTarget: ReadFileContent;
  detail: ReadFileContent | null;
};

const InputFileSingleFrontComponent = () => {
  const { entries, pushEvent } = useEventLog();
  const [fileContents, setFileContents] = useState<FileSelectionContent[]>([]);
  const [parentFileCounts, setParentFileCounts] = useState<{
    currentTargetFileCount: number;
    detailFileCount: number;
  } | null>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    const detailFiles =
      (event as unknown as { detail?: { files?: File[] } }).detail?.files ?? [];

    pushEvent(event);
    setFileContents(
      await Promise.all(
        files.map(async (file, index) => ({
          currentTarget: await readFileContent(file),
          detail: detailFiles[index]
            ? await readFileContent(detailFiles[index])
            : null,
        })),
      ),
    );
  };

  const handleParentChange = (event: ChangeEvent<HTMLDivElement>) => {
    const detailFiles =
      (event as unknown as { detail?: { files?: File[] } }).detail?.files ?? [];
    const currentTargetFiles = (
      event.currentTarget as unknown as {
        files?: File[];
      }
    ).files;

    setParentFileCounts({
      currentTargetFileCount: currentTargetFiles?.length ?? 0,
      detailFileCount: detailFiles.length,
    });
  };

  return (
    <FrontComponentCard title="input:file:single">
      <div style={SUBJECT_WRAPPER_STYLE} onChange={handleParentChange}>
        <label style={LABEL_STYLE}>Single file</label>
        <input data-testid="subject" type="file" onChange={handleChange} />
      </div>
      <div data-testid="file-content">{JSON.stringify(fileContents)}</div>
      <div data-testid="parent-file-content">
        {JSON.stringify(parentFileCounts)}
      </div>
      <EventLog entries={entries} />
    </FrontComponentCard>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    'fc-input-file-single-00000000-0000-0000-0000-000000000020',
  name: 'input-file-single-front-component',
  description: 'Front component covering single-file <input type="file">',
  component: InputFileSingleFrontComponent,
});
