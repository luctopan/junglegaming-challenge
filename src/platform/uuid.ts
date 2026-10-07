/** Random UUID v4 from the platform CSPRNG (player and match identities). */
export const newUuid = (): string => crypto.randomUUID();
