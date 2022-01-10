import CollectionsController from '@base/controllers/Collections/CollectionsController';

const collectionController = new CollectionsController();

export const getCollectionInfo = collectionController.getCollectionInformationForEditor.bind(collectionController);

export const postCollectionInfo = collectionController.postCollectionInformation.bind(collectionController);
