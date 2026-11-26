# Automatic city updates

The About page reads `/api/location` on each visit. Its HTML keeps Beijing as
the fallback if the endpoint is unavailable. Updates do not need a redeploy.
The endpoint stores one current city in private Vercel Blob storage. It keeps
no history, coordinates, address, or public update timestamp.

## Server setup

Configure these server-only environment variables on the Vercel project
that serves `shizudio.me`, for the production and preview environments:

- `BLOB_READ_WRITE_TOKEN`: a connected **private** Blob store's read/write token.
- `LOCATION_UPDATE_TOKEN`: a random secret of at least 32 characters.

Keep both out of browser code, repository files, and URLs. Redeploy after
changing environment variables. The local `.vercel` link may identify another
project, so confirm the actual domain owner before configuring it.

Public `GET /api/location` returns `{"city":"Beijing"}` (or the saved city).
Authenticated `POST /api/location` accepts only a JSON object with one `city`
string. It requires `Authorization: Bearer YOUR_PRIVATE_UPDATE_TOKEN` and
`Content-Type: application/json`. Never send the full Location object.

## iPhone shortcut

On your iPhone, open the [signed shortcut template](https://shizudio.me/shortcuts/wandering-city.shortcut).
Its import question asks for your private update key. Paste the
`LOCATION_UPDATE_TOKEN` value supplied privately; never share the configured
shortcut, since it contains that key. The public template contains only a
placeholder, not a working credential.

The shortcut performs these actions (you can also create them manually):

1. **Get Current Location**.
2. **Get Details of Locations**: select **City** from the current location.
3. **If** City **has any value**. Put the following request inside this block,
   so an unavailable city never clears the last saved one.
4. **Get Contents of URL**: `https://shizudio.me/api/location`.
   Set method to **POST**, add header **Authorization** with value
   `Bearer YOUR_PRIVATE_UPDATE_TOKEN`, and select **JSON** request body.
   Add one text field named **city**, using the **City** output from step 2.
5. End the **If** block.

Run it manually once on the iPhone. Allow location access and requests to
`shizudio.me` when prompted. Confirm the published city before enabling its
automatic runs. The phone resolves coordinates into a city locally through
Apple's location services; only the City text is posted to the website.

Create three **Time of Day** personal automations, daily at **09:00, 15:00,
and 21:00**, each running **Update wandering city** with **Run Immediately**
(or disable **Ask Before Running**, depending on iOS version). Enable
running while locked if that option is shown. These are phone automations,
not a scheduled task running on the website.

This provides automatic periodic updates, not continuous detection of a
city boundary. iOS can delay or fail a run when the phone is offline or
cannot obtain a city; the site keeps its last saved city. Add an **Airplane
Mode → Turned Off** automation for the same shortcut if you want an extra
update after flights. Initial permissions and enabling personal automations
must be completed on the iPhone.

To stop updates, disable the personal automations. To revoke a shortcut's
write access, rotate `LOCATION_UPDATE_TOKEN` and redeploy; update the phone
with the new token before re-enabling it.

Apple references: [personal automations](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios)
and [API requests in Shortcuts](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios).
