import { serializeFileList } from '../serializeFileList';

const createFile = (contents: string, name = 'report.csv') =>
  new File([contents], name, {
    type: 'text/csv',
    lastModified: 1700000000000,
  });

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = () => resolve(fileReader.result as string);
    fileReader.onerror = () => reject(fileReader.error);
    fileReader.readAsText(file);
  });

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
    fileReader.onerror = () => reject(fileReader.error);
    fileReader.readAsArrayBuffer(file);
  });

describe('serializeFileList', () => {
  it('should return undefined for a non-object', () => {
    expect(serializeFileList(null)).toBeUndefined();
    expect(serializeFileList('files')).toBeUndefined();
  });

  it('should return undefined when there is no numeric length', () => {
    expect(serializeFileList({})).toBeUndefined();
  });

  it('should preserve a single native File and its contents', async () => {
    const file = createFile('file contents');
    const result = serializeFileList([file]);

    expect(result).toEqual([file]);
    expect(result?.[0]).toBe(file);
    expect(result?.[0]).toMatchObject({
      name: 'report.csv',
      size: 13,
      type: 'text/csv',
      lastModified: 1700000000000,
    });
    expect(await readFileAsText(result![0])).toBe('file contents');
    expect(await readFileAsArrayBuffer(result![0])).toEqual(
      new TextEncoder().encode('file contents').buffer,
    );
  });

  it('should preserve multiple native Files in order', () => {
    const firstFile = createFile('first', 'first.csv');
    const secondFile = createFile('second', 'second.csv');

    expect(serializeFileList([firstFile, secondFile])).toEqual([
      firstFile,
      secondFile,
    ]);
  });

  it('should skip malformed entries and metadata-only objects', () => {
    const file = createFile('valid');
    const result = serializeFileList({
      length: 4,
      0: file,
      1: { name: 'fake.txt', size: 4, type: 'text/plain', lastModified: 1 },
      2: { name: 'incomplete' },
      3: null,
    });

    expect(result).toEqual([file]);
  });

  it('should return an empty array for an empty selection', () => {
    expect(serializeFileList([])).toEqual([]);
  });

  it('should preserve an empty native File', async () => {
    const file = createFile('');
    const result = serializeFileList([file]);

    expect(result?.[0]).toBe(file);
    expect(result?.[0].size).toBe(0);
    expect(await readFileAsText(result![0])).toBe('');
  });
});
