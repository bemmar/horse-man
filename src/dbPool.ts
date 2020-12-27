import { Collection, Db, MongoClient } from 'mongodb'

let cachedMongoClient: MongoClient | null = null;
let gooDb: Db | null = null;
let transactionCollection: null | Collection = null;

export default async function (): Promise<Collection> {
    if (transactionCollection) {
        return transactionCollection;
    }

    const client = new MongoClient(process.env.MONGO_CONNECTION!, {
        useUnifiedTopology: true
    });

    await client.connect();

    cachedMongoClient = client;
    gooDb = cachedMongoClient.db('goo');
    transactionCollection = gooDb.collection('transaction');

    return transactionCollection;
}