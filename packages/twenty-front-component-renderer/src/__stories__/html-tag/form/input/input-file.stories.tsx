import { type Meta, type StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { FrontComponentRenderer } from '@/host/components/FrontComponentRenderer';
import {
  FRONT_COMPONENT_STORY_DEFAULT_ARGS,
  hostApiMocks,
  resetFrontComponentStoryMocks,
} from '@/__stories__/shared/test-utils/createFrontComponentStoryMeta';
import { expectEventLogged } from '@/__stories__/shared/test-utils/matchers/expectEventLogged';
import { expectFrontComponentMounted } from '@/__stories__/shared/test-utils/matchers/expectFrontComponentMounted';
import { runFrontComponentStory } from '@/__stories__/shared/test-utils/runFrontComponentStory';
import { type UploadFileFunction } from 'twenty-sdk/front-component';

const FILES_FIELD_METADATA_ID = '11111111-1111-4111-8111-111111111111';

const meta: Meta<typeof FrontComponentRenderer> = {
  title: 'FrontComponent/HtmlTag/Form/Input/File',
  component: FrontComponentRenderer,
  parameters: { layout: 'centered' },
  args: FRONT_COMPONENT_STORY_DEFAULT_ARGS,
  beforeEach: resetFrontComponentStoryMocks,
};

export default meta;

type Story = StoryObj<typeof FrontComponentRenderer>;

export const SingleFile: Story = runFrontComponentStory({
  frontComponentBundleName: 'input-file-single',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectFrontComponentMounted(canvas);

    const subject = (await canvas.findByTestId('subject')) as HTMLInputElement;

    const file = new File(['hello world'], 'hello.txt', {
      type: 'text/plain',
      lastModified: 1700000000000,
    });

    await userEvent.upload(subject, file);

    await expectEventLogged({
      canvas,
      matcher: {
        type: 'change',
        files: [{ name: 'hello.txt', type: 'text/plain' }],
      },
    });

    const fileContent = await canvas.findByTestId('file-content');

    await waitFor(() => {
      expect(fileContent.textContent).toContain('"text":"hello world"');
      expect(fileContent.textContent).toContain(
        '"bytes":[104,101,108,108,111,32,119,111,114,108,100]',
      );
      expect(fileContent.textContent).toContain('"lastModified":1700000000000');
      expect(fileContent.textContent).toContain('"isFile":true');
      expect(fileContent.textContent).toContain('"isBlob":true');
      expect(fileContent.textContent).toContain('"detail":{"name":"hello.txt"');
    });

    expect(subject.files?.[0]?.name).toBe('hello.txt');
    expect(await canvas.findByTestId('parent-file-content')).toHaveTextContent(
      '{"currentTargetFileCount":0,"detailFileCount":0}',
    );
  },
});

export const SingleFilePreact: Story = runFrontComponentStory({
  frontComponentBundleName: 'input-file-single',
  runtime: 'preact',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectFrontComponentMounted(canvas);

    const subject = (await canvas.findByTestId('subject')) as HTMLInputElement;
    await userEvent.upload(subject, new File(['preact'], 'preact.txt'));

    const fileContent = await canvas.findByTestId('file-content');

    await waitFor(() => {
      expect(fileContent.textContent).toContain('"text":"preact"');
      expect(fileContent.textContent).toContain('"isFile":true');
      expect(fileContent.textContent).toContain('"isBlob":true');
    });
  },
});

export const MultipleFiles: Story = runFrontComponentStory({
  frontComponentBundleName: 'input-file-multiple',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectFrontComponentMounted(canvas);

    const subject = (await canvas.findByTestId('subject')) as HTMLInputElement;

    const first = new File(['a'], 'one.png', { type: 'image/png' });
    const second = new File(['bb'], 'two.png', { type: 'image/png' });

    await userEvent.upload(subject, [first, second]);

    await expectEventLogged({
      canvas,
      matcher: {
        type: 'change',
        files: [
          { name: 'one.png', type: 'image/png' },
          { name: 'two.png', type: 'image/png' },
        ],
      },
    });

    const fileContent = await canvas.findByTestId('file-content');

    await waitFor(() => {
      expect(fileContent.textContent).toContain('"text":"a"');
      expect(fileContent.textContent).toContain('"text":"bb"');
      expect(fileContent.textContent).toContain('"bytes":[97]');
      expect(fileContent.textContent).toContain('"bytes":[98,98]');
      expect(fileContent.textContent).toContain('"isFile":true');
      expect(fileContent.textContent).toContain('"isBlob":true');
    });

    expect(await canvas.findByTestId('parent-file-content')).toHaveTextContent(
      '{"currentTargetFileCount":0,"detailFileCount":0}',
    );
  },
});

export const MultipleFilesPreact: Story = runFrontComponentStory({
  frontComponentBundleName: 'input-file-multiple',
  runtime: 'preact',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expectFrontComponentMounted(canvas);

    const subject = (await canvas.findByTestId('subject')) as HTMLInputElement;
    await userEvent.upload(subject, [
      new File(['one'], 'one.png', { type: 'image/png' }),
      new File(['two'], 'two.png', { type: 'image/png' }),
    ]);

    const fileContent = await canvas.findByTestId('file-content');

    await waitFor(() => {
      expect(fileContent.textContent).toContain('"text":"one"');
      expect(fileContent.textContent).toContain('"text":"two"');
      expect(fileContent.textContent).toContain('"isFile":true');
      expect(fileContent.textContent).toContain('"isBlob":true');
    });
  },
});

export const UploadSelectedFiles: Story = runFrontComponentStory({
  frontComponentBundleName: 'input-file-upload',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const receivedFiles: {
      name: string;
      fieldMetadataId: string;
      text: string;
      bytes: number[];
      isFile: boolean;
      isBlob: boolean;
    }[] = [];

    const uploadFileMock: UploadFileFunction = async (file, params) => {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      const text = await file.text();
      const fileName = params.fileName ?? '';

      receivedFiles.push({
        name: fileName,
        fieldMetadataId: params.fieldMetadataId,
        text,
        bytes,
        isFile: file instanceof File,
        isBlob: file instanceof Blob,
      });

      if (file.size === 0) {
        return { status: 'failed', reason: 'invalid-params' };
      }

      if (fileName === 'failure.txt') {
        return { status: 'failed', reason: 'upload-failed' };
      }

      return {
        status: 'uploaded',
        file: {
          fileId: '22222222-2222-4222-8222-222222222222',
          path: fileName,
          url: 'https://example.test/uploaded-file',
          size: file.size,
          mimeType: file.type,
        },
      };
    };

    hostApiMocks.uploadFile.mockImplementation(uploadFileMock);

    await expectFrontComponentMounted(canvas);

    const subject = (await canvas.findByTestId('subject')) as HTMLInputElement;
    await userEvent.upload(subject, [
      new File(['original payload'], 'success.txt', { type: 'text/plain' }),
      new File(['rejected payload'], 'failure.txt', { type: 'text/plain' }),
      new File([], 'empty.txt', { type: 'text/plain' }),
    ]);

    const uploadResults = await canvas.findByTestId('upload-results');

    await waitFor(() => {
      expect(uploadResults.textContent).toContain('"status":"uploaded"');
      expect(uploadResults.textContent).toContain('"reason":"upload-failed"');
      expect(uploadResults.textContent).toContain('"reason":"invalid-params"');
    });

    expect(hostApiMocks.uploadFile).toHaveBeenCalledTimes(3);
    expect(receivedFiles).toHaveLength(3);
    expect(receivedFiles).toEqual(
      expect.arrayContaining([
        {
          name: 'success.txt',
          fieldMetadataId: FILES_FIELD_METADATA_ID,
          text: 'original payload',
          bytes: [
            111, 114, 105, 103, 105, 110, 97, 108, 32, 112, 97, 121, 108, 111,
            97, 100,
          ],
          isFile: true,
          isBlob: true,
        },
        {
          name: 'failure.txt',
          fieldMetadataId: FILES_FIELD_METADATA_ID,
          text: 'rejected payload',
          bytes: [
            114, 101, 106, 101, 99, 116, 101, 100, 32, 112, 97, 121, 108, 111,
            97, 100,
          ],
          isFile: true,
          isBlob: true,
        },
        {
          name: 'empty.txt',
          fieldMetadataId: FILES_FIELD_METADATA_ID,
          text: '',
          bytes: [],
          isFile: true,
          isBlob: true,
        },
      ]),
    );
  },
});
