# Local files in Front Components

## Audit findings

[Issue #23826](https://github.com/twentyhq/twenty/issues/23826) reports that the native picker opens but the Front Component receives file metadata without readable contents. [PR #20458](https://github.com/twentyhq/twenty/pull/20458), merged as [75c22a2](https://github.com/twentyhq/twenty/commit/75c22a21197993f85a88f7d98ed0c6857809bc81), deliberately limited the event payload to metadata. Its discussion describes forwarding bytes through `postMessage` and adding a host upload API as a larger design decision outside that PR's scope. This was a scope and transport-design deferral, with a security consequence: apps could not read picker-selected bytes. It was not documented as a sandbox security rule.

The current path starts in `host/elements/utils/buildHostReactPropsFromRemoteProps.ts`; `host/events/utils/wrapEventHandler.ts` calls `host/events/utils/serializeEvent.ts`, which collects original files in `host/events/utils/serializeFileList.ts`. The event and file payload types are `types/SerializedEventData.ts` and `types/SerializedFileData.ts`. The callback crosses the Remote DOM thread over a `MessagePort`; `remote/elements/utils/applySerializedEventTargetProperties.ts` assigns the file array, and the generated remote elements dispatch the worker event with the serialized payload as `detail`. `@quilted/threads` structured-clone transport preserves native `File`/`Blob` methods in this path. `FileList` itself is not relied on: the host sends an array of the original `File` objects. The worker event exposes that array through `event.currentTarget.files` and `event.detail.files`.

The audit also checked [PR #26356](https://github.com/twentyhq/twenty/pull/26356), which was still open on 2026-10-03 and proposes a broad event-forwarding refactor. Its changes are not present in this fork's audited renderer path, so this patch stays at the current serializer rather than adopting its broader settled-event forwarding.

## Behavior and boundaries

Only a `change` handled by the same file input that is the event target carries files. Bubbling listeners on parent elements do not receive a child's files. File-input `value` is omitted, so the browser's fake path is neither synchronized nor written back. Other event and input properties keep their existing serialization.

Files are passed as native objects and are not eagerly converted to strings, Base64, or `ArrayBuffer`s for transport. The worker can explicitly call `text()` or `arrayBuffer()`. As with any selected file, reading or uploading a large file uses memory and bandwidth proportional to the requested operation.

The host picker and serializer run in the same browser window; after structured cloning, the worker receives its own native `File` instance. The change grants access only to files the user selected in that input. It does not expose filesystem paths or other host inputs, alter the sandbox origin, or relax host API/fetch restrictions.

`uploadFile()` remains limited to an existing FILES field metadata ID. Twenty's host upload implementation validates the field and Blob and rejects zero-byte files. Uploading returns a file reference; attaching that reference to a particular CRM record is a separate record update. Arbitrary binary uploads to app endpoints remain subject to the existing fetch proxy restrictions.

## SDK example

Use the metadata ID of a real FILES field in the current app. `uploadFile()` stores the bytes through Twenty's existing host upload path; the returned reference still needs a separate record update if it should be attached to a particular record.

```tsx
import { type ChangeEvent, useState } from 'react';
import { uploadFile } from 'twenty-sdk/front-component';

const FILES_FIELD_METADATA_ID = 'replace-with-your-files-field-metadata-id';

type SelectedFileResult = {
  name: string;
  text: string;
  byteLength: number;
  uploadStatus: string;
};

export const LocalFileUpload = () => {
  const [results, setResults] = useState<SelectedFileResult[]>([]);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);

    const nextResults = await Promise.all(
      files.map(async (file) => {
        const [text, contents] = await Promise.all([
          file.text(),
          file.arrayBuffer(),
        ]);

        try {
          const result = await uploadFile(file, {
            fieldMetadataId: FILES_FIELD_METADATA_ID,
            fileName: file.name,
          });

          return {
            name: file.name,
            text,
            byteLength: contents.byteLength,
            uploadStatus: result.status,
          };
        } catch {
          return {
            name: file.name,
            text,
            byteLength: contents.byteLength,
            uploadStatus: 'failed',
          };
        }
      }),
    );

    setResults(nextResults);
  };

  return (
    <section>
      <input type="file" multiple onChange={handleChange} />
      {results.map((result) => (
        <pre key={result.name}>
          {result.name} ({result.byteLength} bytes, {result.uploadStatus}){'\n'}
          {result.text}
        </pre>
      ))}
    </section>
  );
};
```

## Verification

The Storybook test runs the actual `FrontComponentRenderer`, sandbox worker, and thread transport. It selects browser-generated files, reads `text()` and `arrayBuffer()` in the worker, checks both event access paths, verifies parent listeners receive no files, and calls the SDK's `uploadFile()` through the host API bridge. The bridge fixture reads and checks the original native `File` bytes and tests successful, failed, and zero-byte responses. It uses a FILES-field fixture ID and mocked upload response; it does not contact live storage or verify a CRM record update.

Passing checks:

- `npx jest packages/twenty-front-component-renderer/src/host/events/utils/__tests__/serializeFileList.test.ts packages/twenty-front-component-renderer/src/host/events/utils/__tests__/serializeEvent.test.ts --config=packages/twenty-front-component-renderer/jest.config.mjs --runInBand`: 2 suites, 32 tests passed.
- The Storybook command below passed 5 stories in each of Chromium, Firefox, and WebKit (15 browser/story executions).
- `npx nx run twenty-front-component-renderer:storybook:prebuild --excludeTaskDependencies --skip-nx-cache`: 289 React and 289 Preact examples built.
- `npx nx run twenty-sdk:build --excludeTaskDependencies`, `npx nx run twenty-ui:build:individual --excludeTaskDependencies --skip-nx-cache`, `npx nx run twenty-front-component-renderer:sandbox:prebuild --excludeTaskDependencies --skip-nx-cache`, `npx nx run twenty-front-component-renderer:build --excludeTaskDependencies --skip-nx-cache`, and `npx nx run twenty-front:build --excludeTaskDependencies --skip-nx-cache` passed.
- Changed-file `oxlint` and `oxfmt --check` passed.

Cross-browser command, run from this package after temporarily setting the Storybook Vitest `instances` to Chromium, Firefox, and WebKit:

```bash
npx vitest run --config vitest.storybook.config.ts --project=storybook src/__stories__/html-tag/form/input/input-file.stories.tsx
```

The renderer serializer shape did not change, so its generated Remote DOM files remain unchanged. The direct `generate-remote-dom-elements` command wrote identical generated outputs but remained idle under the repository's Node/tsx/`@prettier/sync` runner and was interrupted; renderer sandbox, story, and package builds were run afterward with their already-built dependencies excluded from Nx scheduling.

Before the upstream update, `npx tsgo -p packages/twenty-front-component-renderer/tsconfig.json --noEmit` reported an implicit-`any` diagnostic at `src/__stories__/twenty-ui-gallery/twenty-ui-settings-row.front-component.tsx:18`. After rebuilding the updated shared package, the complete renderer check passed with no diagnostics.

## Revalidation against upstream

The implementation was revalidated on top of `origin/main` at `b85da000673835e70128d472a259b78b548b5ef1`. The upstream changes do not modify the renderer serializer, SDK Front Component upload bridge, or frontend upload hook. A fresh shared build and the affected application artifacts were rebuilt before testing:

- `node packages/twenty-shared/scripts/generateBarrels.ts` and `npx nx build twenty-shared --skip-nx-cache --excludeTaskDependencies`: passed.
- `npx nx run twenty-sdk:build --excludeTaskDependencies --skip-nx-cache`: passed.
- `npx nx run twenty-front-component-renderer:sandbox:prebuild --excludeTaskDependencies --skip-nx-cache` and `npx nx run twenty-front-component-renderer:storybook:prebuild --excludeTaskDependencies --skip-nx-cache`: passed; 289 React and 289 Preact examples built.
- `npx jest packages/twenty-front-component-renderer/src/host/events/utils/__tests__/serializeFileList.test.ts packages/twenty-front-component-renderer/src/host/events/utils/__tests__/serializeEvent.test.ts --config=packages/twenty-front-component-renderer/jest.config.mjs --runInBand`: passed, 2 suites and 32 tests.
- From `packages/twenty-front-component-renderer`, `npx vitest run --config vitest.storybook.config.ts --project=storybook src/__stories__/html-tag/form/input/input-file.stories.tsx`: passed, all 5 real-browser stories in Chromium.
- `npx nx run twenty-front-component-renderer:build --excludeTaskDependencies --skip-nx-cache` and, from the renderer package, `npx tsgo -p tsconfig.json --noEmit`: passed, including the full renderer typecheck.
- `npx nx run twenty-front:build --excludeTaskDependencies --skip-nx-cache`: passed.

The cross-browser Storybook matrix (Chromium, Firefox, and WebKit; 15 story/browser executions) passed before the upstream update. The renderer event path was unchanged by the upstream commits; the Chromium sandbox suite was rerun against the updated tree.
