import CollectionsController from '@services/infinity/collections/CollectionsController';

const collectionsController = new CollectionsController();
export const getHistoricalTwitterData = collectionsController.getHistoricalData.bind(collectionsController)('twitter');
