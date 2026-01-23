import { IUser } from "../options/IUser";

export function serializeUser(user: IUser | undefined): string {
  if (!user) {
    return '';
  }

  const builtInProperties = `${user.keyId},${user.name ?? ''}`;

  const customizedProperties = user.customizedProperties
    ?.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) {
        return -1;
      }

      if (nameA > nameB) {
        return 1;
      }

      return 0;
    })
    .map(p => `${p.name}:${p.value}`)
    .join(',');

  return `${builtInProperties},${customizedProperties}`;
}

export async function hashSerializeUser(
  user: IUser | undefined
): Promise<string> {
  const serialized = serializeUser(user);

  if (!serialized) {
    return '';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
}
