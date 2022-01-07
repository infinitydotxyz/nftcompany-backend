import CollectionsController from '@base/controllers/CollectionsController';

const collectionsController = new CollectionsController();
export const getHistoricalDiscordData = collectionsController.getHistoricalData.bind(collectionsController)('discord');
