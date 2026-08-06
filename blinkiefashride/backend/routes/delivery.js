const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const auth = require('../utils/auth');

// Get all deliveries for logged-in rider
router.get('/', auth, deliveryController.getDeliveries);

// Get specific delivery details
router.get('/:id', auth, deliveryController.getDeliveryDetail);
router.get('/:id/detail', auth, deliveryController.getDeliveryDetail);

// Update delivery status (assigned → picked → completed)
router.patch('/:id/status', auth, deliveryController.updateStatus);

// Mark rider has reached vendor/store location → generates store OTP
router.post('/:id/store-arrived', auth, deliveryController.markStoreArrived);
router.post('/:id/mark-store-arrived', auth, deliveryController.markStoreArrived);

// Verify store pickup OTP (rider enters OTP given by vendor)
router.post('/:id/verify-store-otp', auth, deliveryController.verifyStoreOtp);

// Mark rider has reached customer location
router.post('/:id/mark-arrived', auth, deliveryController.markArrived);
router.post('/:id/arrived', auth, deliveryController.markArrived);

// Verify delivery OTP (customer enters OTP given by rider)
router.post('/:id/verify-delivery-otp', auth, deliveryController.verifyOtp);
router.post('/:id/verify-otp', auth, deliveryController.verifyOtp);

// Handle try & buy selection (before payment)
router.post('/:id/try-buy-select', auth, deliveryController.tryBuySelect);
router.post('/:id/try-and-buy-select', auth, deliveryController.tryBuySelect);

// Handle try & buy decision (accepted/rejected)
router.post('/:id/try-buy-complete', auth, deliveryController.tryBuyComplete);
router.post('/:id/try-and-buy-decision', auth, deliveryController.tryBuyComplete);

module.exports = router;
