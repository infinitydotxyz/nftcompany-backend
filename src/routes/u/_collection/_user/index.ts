import CollectionEditorController from '@base/controllers/CollectionEditorController';

const collectionEditorController = new CollectionEditorController();

export const getCollectionInfo = collectionEditorController.getCollectionInfo.bind(collectionEditorController);
