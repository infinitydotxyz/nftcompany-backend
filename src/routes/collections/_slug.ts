import CollectionsController from '@base/controllers/Collections/CollectionsController';

const collectionsController = new CollectionsController();
export const getCollectionInfo = collectionsController.getCollectionInfo.bind(collectionsController);
