import { Router } from 'express';
import screenshotsRouter from './screenshots';
import blurryRouter from './blurry';
import duplicatesRouter from './duplicates';
import peopleRouter from './people';
import documentsRouter from './documents';
import smartFoldersRouter from './smart-folders';

const router = Router();

router.use('/screenshots', screenshotsRouter);
router.use('/blurry', blurryRouter);
router.use('/duplicates', duplicatesRouter);
router.use('/people', peopleRouter);
router.use('/documents', documentsRouter);
router.use('/smart-folders', smartFoldersRouter);

export default router;
