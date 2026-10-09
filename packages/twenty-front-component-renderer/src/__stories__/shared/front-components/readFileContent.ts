export type ReadFileContent = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  text: string;
  bytes: number[];
  isFile: boolean;
  isBlob: boolean;
};

export const readFileContent = async (file: File): Promise<ReadFileContent> => {
  const [text, arrayBuffer] = await Promise.all([
    file.text(),
    file.arrayBuffer(),
  ]);

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    text,
    bytes: Array.from(new Uint8Array(arrayBuffer)),
    isFile: file instanceof File,
    isBlob: file instanceof Blob && file.slice() instanceof Blob,
  };
};
