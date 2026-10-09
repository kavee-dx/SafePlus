/**
 * Unit tests never open a socket to the shared database, so this stands in for
 * `config/db`: importing a service that reaches for the pool stays cheap and a
 * stray query fails loudly instead of writing.
 */
export const query = jest.fn(async () => ({ rows: [], rowCount: 0 }));

export const getClient = jest.fn(async () => ({
  query,
  release: jest.fn(),
}));

export const end = jest.fn(async () => undefined);

export default { query, getClient, end };
