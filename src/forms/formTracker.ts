import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import serviceAccount from "../../service_account.json";

const serviceAccountAuth = new JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const formTrackerSheet = new GoogleSpreadsheet(
  process.env.FORM_TRACKER_ID!,
  serviceAccountAuth
);

/**
 * Initializes the form tracker sheet
 * @return the form tracker sheet
 */
export const initSheet = async (): Promise<GoogleSpreadsheet> => {
  await formTrackerSheet.loadInfo();
  console.log("✅ Loaded form tracker sheet");
  return formTrackerSheet;
};
