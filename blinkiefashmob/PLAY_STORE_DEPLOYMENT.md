# 📱 Google Play Store Deployment Guide — BlinkieFash

Complete guide to generate the signed App Bundle (`.aab`) and upload it to Google Play Console.

---

## 📋 Prerequisites

- ✅ Google Play Developer account ($25 one-time fee) — https://play.google.com/console
- ✅ App icon (512x512 PNG)
- ✅ Feature graphic (1024x500 PNG)
- ✅ At least 2 screenshots (phone)
- ✅ Privacy Policy URL (required)
- ✅ App description (short + full)

---

## 🔐 Step 1 — Generate the Upload Keystore (ONE-TIME ONLY)

⚠️ **CRITICAL:** Save the keystore file and passwords in a safe place. You **cannot recover** them — if lost, you can never update your app on Play Store again.

Open Terminal and run:

```bash
cd /Users/sa40091223/Downloads/SatyXAlka/blinkiefashmob

/Applications/Android\ Studio.app/Contents/jbr/Contents/Home/bin/keytool \
  -genkey -v \
  -keystore ~/blinkiefash-upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

It will ask:

| Prompt | What to type |
|---|---|
| Enter keystore password | Choose a strong password (remember it!) |
| Re-enter new password | Same password |
| What is your first and last name? | Your name or company name |
| What is the name of your organizational unit? | (e.g. "Engineering" or press Enter) |
| What is the name of your organization? | BlinkieFash |
| What is the name of your City or Locality? | Bhubaneswar |
| What is the name of your State or Province? | Odisha |
| What is the two-letter country code? | IN |
| Is CN=..., OU=..., O=..., correct? | yes |
| Enter key password for <upload> | Press Enter (uses keystore password) |

After this, a file `blinkiefash-upload-keystore.jks` is created in your home folder.

---

## 🔑 Step 2 — Create `key.properties` File

Create a new file at `android/key.properties` with your keystore details:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD_HERE
keyPassword=YOUR_KEYSTORE_PASSWORD_HERE
keyAlias=upload
storeFile=/Users/sa40091223/blinkiefash-upload-keystore.jks
```

⚠️ **IMPORTANT:**
- Replace `YOUR_KEYSTORE_PASSWORD_HERE` with the actual password you used in Step 1.
- This file is already in `.gitignore` so it won't be committed.
- **Never share this file or push to git.**

---

## 📝 Step 3 — Update Version Number

Edit [pubspec.yaml](pubspec.yaml) line 19:

```yaml
version: 1.0.0+1
```

Format: `versionName+versionCode`
- `1.0.0` = User-visible version
- `+1` = Internal version code (must increment for every Play Store upload)

For each new release, increment the build number:
- First upload: `1.0.0+1`
- Next update: `1.0.1+2`
- Major update: `2.0.0+3`

---

## 🏗️ Step 4 — Build the Signed App Bundle

```bash
cd /Users/sa40091223/Downloads/SatyXAlka/blinkiefashmob
flutter clean
flutter pub get
flutter build appbundle --release
```

This takes 3–10 minutes. When done, your file is at:

```
build/app/outputs/bundle/release/app-release.aab
```

✅ **This `.aab` file is what you upload to Play Store.**

---

## 🌐 Step 5 — Create App in Google Play Console

1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Fill in:
   - App name: `BlinkieFash`
   - Default language: English (United States)
   - App or game: **App**
   - Free or paid: **Free**
   - Accept declarations
4. Click **Create app**

---

## 📤 Step 6 — Set Up App for First Submission

In Play Console, complete these sections (left sidebar):

### A. App content (Policy section)
- ✅ Privacy policy (URL required)
- ✅ App access (free for all, or restricted)
- ✅ Ads (does the app contain ads? Yes/No)
- ✅ Content rating questionnaire
- ✅ Target audience (age groups)
- ✅ News app declaration
- ✅ COVID-19 contact tracing (No)
- ✅ Data safety (data collection disclosure)
- ✅ Government apps (No)
- ✅ Financial features (No, unless you handle payments directly)

### B. Store presence → Main store listing
- App name: `BlinkieFash`
- Short description (max 80 chars): `Fast fashion delivery in 60 minutes — Try & Buy at home`
- Full description (max 4000 chars): Write 2-3 paragraphs about features
- App icon: 512x512 PNG
- Feature graphic: 1024x500 PNG
- Phone screenshots: 2-8 images (min 320px, max 3840px)
- App category: **Shopping**
- Tags: Choose relevant ones

### C. Pricing & distribution
- Countries to release in (e.g. India)
- Pricing: Free
- Contains ads: Yes/No

---

## 📦 Step 7 — Upload the App Bundle

1. In Play Console, go to **Release → Production → Create new release**
2. Click **"Upload"** and select your `app-release.aab` file
3. Add release notes (what's new in this version)
4. Click **Save** then **Review release**
5. Click **Start rollout to Production**

For the first upload, Google may also ask you to:
- Set up **App signing by Google Play** (highly recommended — keeps your keys safe)
- Upload screenshots if not done yet

---

## ⏱️ Step 8 — Wait for Review

- First-time apps: 1-7 days for review
- Updates: usually a few hours to 1 day
- Google emails you the status

If rejected, fix the issues (usually privacy policy, permissions, or content rating) and re-upload an `.aab` with **incremented version code**.

---

## 🔄 Step 9 — Future Updates

Each new release:

1. **Increment version** in `pubspec.yaml`:
   ```yaml
   version: 1.0.1+2
   ```
2. **Rebuild**:
   ```bash
   flutter clean && flutter build appbundle --release
   ```
3. **Upload new .aab** in Play Console → Production → Create new release

---

## 🛡️ Step 10 — Backup Critical Files

Save these in a secure place (1Password, encrypted vault, etc.):

1. `~/blinkiefash-upload-keystore.jks` (keystore file)
2. Keystore password
3. Key alias name (`upload`)
4. `android/key.properties` content

If you lose any of these, you **cannot update your app**.

---

## 🚨 Common Issues

### "App bundle is not signed"
- Check `android/key.properties` exists and points to the correct keystore.

### "Invalid key alias"
- The `keyAlias` in `key.properties` must match what you used in `keytool` (we used `upload`).

### "Version code already used"
- Increment `versionCode` (the number after `+` in pubspec.yaml).

### Build fails with "Keystore was tampered with"
- Wrong password in `key.properties`. Use the password you set in Step 1.

### "Your app targets API level X but should target Y"
- Update `targetSdk` in `android/app/build.gradle.kts`. Google requires API 34+ as of 2024.

---

## 📞 Quick Command Reference

```bash
# Build signed App Bundle
flutter clean
flutter build appbundle --release

# Output location
open build/app/outputs/bundle/release/

# Verify .aab is signed correctly
/Applications/Android\ Studio.app/Contents/jbr/Contents/Home/bin/keytool \
  -list -v \
  -keystore ~/blinkiefash-upload-keystore.jks \
  -alias upload
```

---

**Application ID:** `com.blinkie_fash.Customer1`
**Current Version:** `1.0.0+1`
**Bundle Output:** `build/app/outputs/bundle/release/app-release.aab`
