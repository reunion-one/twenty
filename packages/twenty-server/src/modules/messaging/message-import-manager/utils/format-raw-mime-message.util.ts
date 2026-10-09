export const formatRawMimeMessage = (rawMessage: Buffer) => ({
  encoding: 'base64' as const,
  data: rawMessage.toString('base64'),
});
