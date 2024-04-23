import { IUser } from "../options/IUser";

export function serializeUser(user: IUser | undefined): string {
  if (!user) {
    return '';
  }

  const builtInProperties = `${user.keyId},${user.name}`;

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