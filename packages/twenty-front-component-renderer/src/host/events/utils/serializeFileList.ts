import { isNumber, isObject } from '@sniptt/guards';

import { type SerializedFileData } from '@/types/SerializedFileData';

export const serializeFileList = (
  files: unknown,
): SerializedFileData[] | undefined => {
  if (!isObject(files)) {
    return undefined;
  }
  const fileListLike = files as { length?: unknown } & Record<number, unknown>;
  if (!isNumber(fileListLike.length)) {
    return undefined;
  }

  const serialized: SerializedFileData[] = [];
  for (let index = 0; index < fileListLike.length; index++) {
    const file = fileListLike[index];
    if (
      !isObject(file) ||
      typeof File === 'undefined' ||
      !(file instanceof File)
    ) {
      continue;
    }
    serialized.push(file);
  }

  return serialized;
};
