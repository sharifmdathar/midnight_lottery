// Configuration for local Midnight services
export const config = {
    node: 'http://localhost:9944',
    indexer: 'http://localhost:8088/api/v3/graphql',
    indexerWS: 'ws://localhost:8088/api/v3/graphql/ws',
    proofServer: 'http://localhost:6300',
    zkConfigPath: '/managed/lottery',
    privateStateStoreName: 'lottery-private-state-browser',
};
