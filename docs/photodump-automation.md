# Photodump upload API

This backend publishes a selected album's uploaded photographs, approximate capture locations and capture dates. It does not read iCloud directly, watch an iPhone album, or include the map interface. Uploading publishes the photo immediately to the public API.

## Server configuration

Configure `BLOB_READ_WRITE_TOKEN` for the existing private Vercel Blob store and a separate random `PHOTODUMP_UPDATE_TOKEN` of at least 32 characters. Neither belongs in browser code, committed files, logs or URLs. Confirm which Vercel project owns `shizudio.me` before configuration; the local project link may differ. Redeployment is required after configuration changes.

The backend imports `sharp` at runtime. Ensure it remains installed in the deployed function; it is declared in the repository's production dependencies.

## Upload contract

`POST /api/photodump`, with `Authorization: Bearer YOUR_PRIVATE_UPDATE_TOKEN` and `Content-Type: application/json`:

```json
{
  "imageBase64": "BASE64_ENCODED_JPEG_WITHOUT_LINE_BREAKS",
  "capturedAt": "2026-11-26T09:00:00Z",
  "latitude": 31.234567,
  "longitude": 121.478912
}
```

The image must decode to a valid JPEG of at most 2 MiB. Use an ISO 8601 date with timezone. Coordinates must be numeric and valid; omit both fields if there is no recorded location. No other fields are accepted. The server re-encodes the image, applies orientation, limits it to 2000 pixels per side and strips embedded metadata. Only coordinates rounded to two decimals are stored or published. This is approximate placement, not a guarantee of anonymity.

The response is `200` with `{id, capturedAt, imageUrl, latitude?, longitude?}`. The ID hashes the sanitized image and normalized metadata; retrying identical input uses the same record. Each photo has its own image and metadata object, avoiding concurrent shared-index overwrites. Changes to image processing or metadata can produce a new ID. A failed record write can leave an unlisted image object; retrying safely completes it.

## Public reads and removal

- `GET /api/photodump` returns `{photos: [...], cursor: string | null}` with at most 50 records per page. Pass the cursor as an encoded `?cursor=` query value until it is null. Ordering follows storage pagination; dates are descending within each page. Clients must collect pages and sort globally for a chronological gallery.
- `GET /api/photodump?image=PHOTO_ID` returns JPEG bytes, without revealing private Blob URLs or credentials.
- `DELETE /api/photodump?id=PHOTO_ID` requires the upload bearer token and removes both stored objects. Removing a photo from the iPhone album does not remove it from the site. Disable syncing before deleting if you do not want the phone to upload it again.

Responses disable caching so future requests reflect removals. Already downloaded copies cannot be revoked. Missing storage configuration returns `503`; rejected authentication returns `401`; malformed input returns `400`, excessive size `413`, unsupported content type `415`, unsupported method `405`, and missing images `404`. Internal storage errors return a generic `503`.

## Verification

Run `node --test tests/photodump.test.js tests/location.test.js`. These exercise the request handler with real image re-encoding and injected storage; live Blob access, deployed function packaging, iPhone execution and album permissions still require integration verification.

## Installable Shortcut template

Install the credential-free template: [Sync Photodump](https://www.icloud.com/shortcuts/b8345f526a4b4986a0078cf0542bef72). The shared template was imported on macOS and its date, image, conditional location and upload action bindings were inspected. The album must be selected on your own device.

The signed, credential-free template is `public/shortcuts/photodump.shortcut`. After deployment it will be available at `/shortcuts/photodump.shortcut`; this path is not live until deployed. On a Mac, open the signed file in Shortcuts; on iPhone, transfer it with AirDrop or open the deployed download in Safari. A true `icloud.com/shortcuts/…` link must be created through Shortcuts sharing after import. Never share a copy containing the real update key.

1. Create a normal Photos album and add only the images you want published.
2. Import the template. Enter the private `PHOTODUMP_UPDATE_TOKEN` and deployed upload endpoint in the setup questions. Use a staging endpoint for the first test.
3. Edit **Find Photos** and set **Album is Choose** to your album. Album identifiers are device-specific, so the template intentionally requires choosing one after import. Do not run until the album filter is configured.
4. Inspect the actions: capture date and original photo location are read before resizing/conversion. A missing location follows the upload branch without coordinates. JPEG conversion uses 1600px width and 65% quality; the server still enforces its 2 MiB limit.
5. Run manually on iPhone and grant access only to the intended photos and your website. Review returned records or errors; the Shortcut displays actual API responses. No iPhone execution has been verified yet.
6. After a successful manual test, optionally create a Time of Day automation that runs the Shortcut. This version revisits the album on each run; deterministic records prevent duplicates but images are still uploaded. It is not an instant album-change trigger or incremental background watcher.

The map/gallery interface is not part of this change. The public API is ready for that interface once deployed and configured.

Regenerate without credentials using `python3 scripts/build-photodump-shortcut.py /tmp/photodump.unsigned.shortcut`, then sign on macOS:

```sh
shortcuts sign --mode anyone --input /tmp/photodump.unsigned.shortcut --output public/shortcuts/photodump.shortcut
```

Signing contacts Apple's validation service. Native macOS import has been checked during development; a successful import does not replace testing Photos permissions and uploads on the iPhone.
