import CollectionsController from '@base/controllers/Collections/CollectionsController';

const collectionsController = new CollectionsController();
export const getHistoricalTwitterData = collectionsController.getHistoricalData.bind(collectionsController)('twitter');
