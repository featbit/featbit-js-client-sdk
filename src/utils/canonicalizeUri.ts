// This function is designed to remove any trailing forward slashes at the end of the provided URI string
export function canonicalizeUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}