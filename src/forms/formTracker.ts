import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import moment from "moment-timezone";
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
  const runDate = moment().tz("America/New_York").toDate();
  console.log(
    `${runDate.getMonth()}/${runDate.getDay()}/${runDate.getFullYear()} ${runDate.getHours()}:${runDate.getMinutes()} ✅ Loaded form tracker sheet`
  );
  return formTrackerSheet;
};
