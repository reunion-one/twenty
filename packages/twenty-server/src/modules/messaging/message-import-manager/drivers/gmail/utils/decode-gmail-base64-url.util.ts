export const decodeGmailBase64Url = (data: string): Buffer => {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);

  if (
    !/^(?:[A-Za-z0-9+/_-]{4})*(?:[A-Za-z0-9+/_-]{2}==|[A-Za-z0-9+/_-]{3}=)?$/.test(
      padded,
    )
  ) {
    throw new Error('invalid Gmail base64url encoding');
  }

  return Buffer.from(padded, 'base64');
};
