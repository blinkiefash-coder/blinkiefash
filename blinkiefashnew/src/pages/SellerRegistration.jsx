import { useMemo, useState } from "react";
import "./sellerRegistration.css";
import { API_API_BASE_URL } from "../apiBase";

const STEP_META = [
	{ id: 1, title: "Basic Info", subtitle: "Start with your contact details." },
	{ id: 2, title: "Business Details", subtitle: "Tell us about your business profile." },
	{ id: 3, title: "Store Setup", subtitle: "Set your store identity and address." },
	{ id: 4, title: "Bank & Submit", subtitle: "Add banking details and complete registration." }
];

const CATEGORY_OPTIONS = [
	"Womens Fashion",
	"Mens Fashion",
	"Kids Wear",
	"Footwear",
	"Beauty & Personal Care",
	"Home Decor",
	"Kitchen & Dining",
	"Furniture & Living"
];

function Stepper({ currentStep }) {
	return (
		<div className="seller-stepper" aria-label="Registration progress">
			{STEP_META.map((step, index) => {
				const status = currentStep > step.id ? "done" : currentStep === step.id ? "active" : "pending";

				return (
					<div key={step.id} className="seller-step-wrap">
						<div className={`seller-step-dot seller-step-${status}`}>{step.id}</div>
						<span className="seller-step-label">{step.title}</span>
						{index !== STEP_META.length - 1 && (
							<div
								className={`seller-step-line ${currentStep > step.id ? "seller-line-done" : ""}`}
								aria-hidden="true"
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

export default function SellerRegistration() {
	const [currentStep, setCurrentStep] = useState(1);
	const [selectedCategories, setSelectedCategories] = useState(["Womens Fashion"]);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [uploadedFiles, setUploadedFiles] = useState({
		logo: null,
		panDoc: null,
		gstDoc: null,
		bankProof: null
	});
	const [formData, setFormData] = useState({
		businessName: "",
		ownerName: "",
		email: "",
		phone: "",
		otp: "",
		password: "",
		businessType: "",
		gstNumber: "",
		panNumber: "",
		yearsInBusiness: "",
		storeName: "",
		storeDescription: "",
		storeAddress: "",
		city: "",
		state: "",
		pincode: "",
		accountHolderName: "",
		accountNumber: "",
		ifscCode: "",
		bankName: "",
		accountType: "",
		acceptTerms: false
	});

	const currentMeta = useMemo(
		() => STEP_META.find((step) => step.id === currentStep) || STEP_META[0],
		[currentStep]
	);

	const handleInputChange = (event) => {
		const { name, value, type, checked } = event.target;
		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value
		}));
	};

	const toggleCategory = (category) => {
		setSelectedCategories((prev) => {
			if (prev.includes(category)) {
				return prev.filter((item) => item !== category);
			}

			return [...prev, category];
		});
	};

	const handleFileChange = (event, key) => {
		const pickedFile = event.target.files?.[0] || null;
		setUploadedFiles((prev) => ({
			...prev,
			[key]: pickedFile
		}));
	};

	const goToPreviousStep = () => {
		setCurrentStep((prev) => Math.max(1, prev - 1));
	};

	const handleNextOrSubmit = async (event) => {
		event.preventDefault();
		setSubmitError("");

		if (currentStep < 4) {
			setCurrentStep((prev) => prev + 1);
			return;
		}

		try {
			setIsSubmitting(true);

			const payload = new FormData();
			payload.append("business_name", formData.businessName);
			payload.append("owner_name", formData.ownerName);
			payload.append("email", formData.email.trim().toLowerCase());
			payload.append("phone", formData.phone);
			payload.append("password", formData.password);
			payload.append("business_type", formData.businessType);
			payload.append("category", selectedCategories.join(", "));
			payload.append("gst_number", formData.gstNumber);
			payload.append("pan_number", formData.panNumber);
			payload.append("years_in_business", formData.yearsInBusiness);
			payload.append("store_name", formData.storeName);
			payload.append("description", formData.storeDescription);
			payload.append("address", formData.storeAddress);
			payload.append("city", formData.city);
			payload.append("state", formData.state);
			payload.append("pincode", formData.pincode);
			payload.append("account_holder_name", formData.accountHolderName);
			payload.append("account_number", formData.accountNumber);
			payload.append("ifsc_code", formData.ifscCode);
			payload.append("bank_name", formData.bankName);

			if (uploadedFiles.logo) payload.append("logo", uploadedFiles.logo);
			if (uploadedFiles.panDoc) payload.append("panDoc", uploadedFiles.panDoc);
			if (uploadedFiles.gstDoc) payload.append("gstDoc", uploadedFiles.gstDoc);
			if (uploadedFiles.bankProof) payload.append("bankProof", uploadedFiles.bankProof);

			const response = await fetch(`${API_API_BASE_URL}/vendor/register`, {
				method: "POST",
				body: payload
			});

			const result = await response.json();
			if (!response.ok || !result.success) {
				throw new Error(result.message || "Seller registration failed");
			}

			setIsSubmitted(true);
		} catch (err) {
			setSubmitError(err.message || "Failed to submit registration");
		} finally {
			setIsSubmitting(false);
		}
	};

	const resetForm = () => {
		setIsSubmitted(false);
		setCurrentStep(1);
		setSubmitError("");
	};

	return (
		<div className="seller-registration-page">
			<div className="seller-registration-glow seller-registration-glow-left" aria-hidden="true" />
			<div className="seller-registration-glow seller-registration-glow-right" aria-hidden="true" />

			<main className="seller-registration-shell">
				<section className="seller-registration-aside">
					<p className="seller-kicker">Vendor Onboarding</p>
					<h1>Seller Registration</h1>
					<p>
						Complete four simple steps to onboard your fashion and home store and start selling on BlinkieFash.
					</p>

					<div className="seller-feature-grid">
						<article>
							<h3>100% Secure</h3>
							<p>Your data is encrypted and stored safely.</p>
						</article>
						<article>
							<h3>Quick Approval</h3>
							<p>Fast verification and onboarding support.</p>
						</article>
						<article>
							<h3>24/7 Support</h3>
							<p>Our team is available whenever you need help.</p>
						</article>
						<article>
							<h3>Grow Faster</h3>
							<p>Reach more customers with your online storefront.</p>
						</article>
					</div>
				</section>

				<section className="seller-registration-card" aria-live="polite">
					{!isSubmitted ? (
						<>
							<header className="seller-registration-header">
								<h2>{currentMeta.title}</h2>
								<p>{currentMeta.subtitle}</p>
							</header>

							<Stepper currentStep={currentStep} />

							<form className="seller-registration-form" onSubmit={handleNextOrSubmit}>
								{currentStep === 1 && (
									<>
										<div className="seller-field-grid two-col">
											<label>
												<span>Business Name</span>
												<input
													name="businessName"
													value={formData.businessName}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter your business name"
													required
												/>
											</label>
											<label>
												<span>Owner Name</span>
												<input
													name="ownerName"
													value={formData.ownerName}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter owner full name"
													required
												/>
											</label>
										</div>

										<div className="seller-field-grid two-col">
											<label>
												<span>Email Address</span>
												<input
													name="email"
													value={formData.email}
													onChange={handleInputChange}
													type="email"
													placeholder="Enter your email"
													required
												/>
											</label>
											<label>
												<span>Phone Number</span>
												<div className="seller-input-inline">
													<input
														name="phone"
														value={formData.phone}
														onChange={handleInputChange}
														type="tel"
														placeholder="Enter mobile number"
														required
													/>
													<button type="button" className="seller-outline-btn">
														Send OTP
													</button>
												</div>
											</label>
										</div>

										<div className="seller-field-grid two-col">
											<label>
												<span>OTP</span>
												<input
													name="otp"
													value={formData.otp}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter 6-digit OTP"
													required
												/>
											</label>
											<label>
												<span>Password</span>
												<input
													name="password"
													value={formData.password}
													onChange={handleInputChange}
													type="password"
													placeholder="Create a strong password"
													required
												/>
											</label>
										</div>
									</>
								)}

								{currentStep === 2 && (
									<>
										<div className="seller-field-grid two-col">
											<label>
												<span>Business Type</span>
												<select
													name="businessType"
													value={formData.businessType}
													onChange={handleInputChange}
													required
												>
													<option value="">Select business type</option>
													<option value="proprietorship">Proprietorship</option>
													<option value="partnership">Partnership</option>
													<option value="private-limited">Private Limited</option>
													<option value="llp">LLP</option>
													<option value="vendor">Vendor</option>
												</select>
											</label>
										</div>

										<div className="seller-chip-block">
											<span className="seller-chip-title">Category (Select all that apply)</span>
											<div className="seller-chip-list">
												{CATEGORY_OPTIONS.map((category) => {
													const isActive = selectedCategories.includes(category);
													return (
														<button
															key={category}
															className={`seller-chip ${isActive ? "seller-chip-active" : ""}`}
															type="button"
															onClick={() => toggleCategory(category)}
														>
															{category}
														</button>
													);
												})}
											</div>
										</div>

										<div className="seller-field-grid two-col">
											<label>
												<span>GST Number (Optional)</span>
												<input
													name="gstNumber"
													value={formData.gstNumber}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter GST number"
												/>
											</label>
											<label>
												<span>PAN Number</span>
												<input
													name="panNumber"
													value={formData.panNumber}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter PAN number"
													required
												/>
											</label>
											<label>
												<span>Years in Business</span>
												<input
													name="yearsInBusiness"
													value={formData.yearsInBusiness}
													onChange={handleInputChange}
													type="number"
													min="0"
													placeholder="Enter years in business"
												/>
											</label>
										</div>
									</>
								)}

								{currentStep === 3 && (
									<>
										<label>
											<span>Store Name</span>
											<input
												name="storeName"
												value={formData.storeName}
												onChange={handleInputChange}
												type="text"
												placeholder="Enter your store name"
												required
											/>
										</label>

										<label>
											<span>Store Description</span>
											<textarea
												name="storeDescription"
												value={formData.storeDescription}
												onChange={handleInputChange}
												placeholder="Tell customers about your store, products, and services"
												maxLength={300}
												rows={4}
											/>
										</label>

										<label>
											<span>Store Address</span>
											<input
												name="storeAddress"
												value={formData.storeAddress}
												onChange={handleInputChange}
												type="text"
												placeholder="Enter complete store address"
												required
											/>
										</label>

										<div className="seller-field-grid two-col">
											<label>
												<span>City</span>
												<input
													name="city"
													value={formData.city}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter city"
													required
												/>
											</label>
											<label>
												<span>State</span>
												<input
													name="state"
													value={formData.state}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter state"
													required
												/>
											</label>
										</div>

										<label>
											<span>Pincode</span>
											<input
												name="pincode"
												value={formData.pincode}
												onChange={handleInputChange}
												type="text"
												placeholder="Enter pincode"
												required
											/>
										</label>

										<label className="seller-upload-box">
											<span>Store Logo</span>
											<input
												type="file"
												accept=".png,.jpg,.jpeg"
												onChange={(event) => handleFileChange(event, "logo")}
											/>
											<p>Upload PNG/JPG up to 2MB</p>
										</label>
									</>
								)}

								{currentStep === 4 && (
									<>
										<h3 className="seller-section-title">Bank Details</h3>

										<div className="seller-field-grid two-col">
											<label>
												<span>Account Holder Name</span>
												<input
													name="accountHolderName"
													value={formData.accountHolderName}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter account holder name"
													required
												/>
											</label>
											<label>
												<span>Account Number</span>
												<input
													name="accountNumber"
													value={formData.accountNumber}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter account number"
													required
												/>
											</label>
										</div>

										<div className="seller-field-grid two-col">
											<label>
												<span>Bank Name</span>
												<input
													name="bankName"
													value={formData.bankName}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter bank name"
													required
												/>
											</label>
											<label>
												<span>IFSC Code</span>
												<input
													name="ifscCode"
													value={formData.ifscCode}
													onChange={handleInputChange}
													type="text"
													placeholder="Enter IFSC code"
													required
												/>
											</label>
											<label>
												<span>Account Type</span>
												<select
													name="accountType"
													value={formData.accountType}
													onChange={handleInputChange}
													required
												>
													<option value="">Select account type</option>
													<option value="savings">Savings</option>
													<option value="current">Current</option>
												</select>
											</label>
										</div>

										<h3 className="seller-section-title">Documents</h3>
										<div className="seller-doc-grid">
											<label className="seller-upload-box compact">
												<span>Aadhar Card</span>
												<input
													type="file"
													accept=".png,.jpg,.jpeg,.pdf"
													required
													onChange={(event) => handleFileChange(event, "bankProof")}
												/>
												<p>JPG/PNG/PDF up to 5MB</p>
											</label>
											<label className="seller-upload-box compact">
												<span>GST Certificate</span>
												<input
													type="file"
													accept=".png,.jpg,.jpeg,.pdf"
													required
													onChange={(event) => handleFileChange(event, "gstDoc")}
												/>
												<p>JPG/PNG/PDF up to 5MB</p>
											</label>
											<label className="seller-upload-box compact">
												<span>PAN Card</span>
												<input
													type="file"
													accept=".png,.jpg,.jpeg,.pdf"
													required
													onChange={(event) => handleFileChange(event, "panDoc")}
												/>
												<p>JPG/PNG/PDF up to 5MB</p>
											</label>
										</div>

										<label className="seller-terms">
											<input
												name="acceptTerms"
												type="checkbox"
												checked={formData.acceptTerms}
												onChange={handleInputChange}
												required
											/>
											<span>I agree to Terms & Conditions and Privacy Policy.</span>
										</label>

										{submitError && <p className="seller-submit-error">{submitError}</p>}
									</>
								)}

								<footer className="seller-action-row">
									{currentStep > 1 && (
										<button className="seller-back-btn" type="button" onClick={goToPreviousStep}>
											Back
										</button>
									)}
									  <button className="seller-next-btn" type="submit" disabled={isSubmitting}>
										{isSubmitting
											? "Submitting..."
											: currentStep === 4
												? "Submit & Complete"
												: "Next"}
									</button>
								</footer>
							</form>
						</>
					) : (
						<div className="seller-success-panel">
							<h2>Registration Submitted</h2>
							<p>
								Your fashion/home seller profile has been submitted successfully. Our onboarding
								team will verify your store details and activate your account shortly.
							</p>
							<button type="button" className="seller-next-btn" onClick={resetForm}>
								Register Another Store
							</button>
						</div>
					)}
				</section>
			</main>
		</div>
	);
}
