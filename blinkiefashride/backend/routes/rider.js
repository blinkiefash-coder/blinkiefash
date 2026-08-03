const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const auth = require('../utils/auth');
const registrationController = require('../controllers/registrationController');

router.post('/register', registrationController.register);
router.post('/login', riderController.login);
router.post('/firebase-login', riderController.firebaseLogin);
router.get('/profile', auth, riderController.getProfile);
router.get('/kyc', auth, riderController.getKYC);
router.get('/earnings', auth, riderController.getEarnings);
router.get('/reviews', auth, riderController.getReviews);
router.get('/shifts', auth, riderController.getShifts);
router.get('/notifications', auth, riderController.getNotifications);
router.get('/support', auth, riderController.getSupportTickets);
router.patch('/availability', auth, riderController.toggleAvailability);
router.patch('/location', auth, riderController.updateLocation);
router.patch('/fcm-token', auth, riderController.saveFcmToken);


module.exports = router;
