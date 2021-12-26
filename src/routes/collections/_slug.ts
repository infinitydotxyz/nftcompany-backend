import CollectionsController from '@services/infinity/collections/CollectionsController';

const collectionsController = new CollectionsController();
export const getCollectionInfo = collectionsController.getCollectionInfo.bind(collectionsController);
