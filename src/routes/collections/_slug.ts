import CollectionsController from '@base/controllers/CollectionsController';

const collectionsController = new CollectionsController();
export const getCollectionInfo = collectionsController.getCollectionInfo.bind(collectionsController);
