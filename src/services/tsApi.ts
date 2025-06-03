import Qs from 'qs';
import Axios, {AxiosInstance} from 'axios';
import {BookingInfo, PatientInfo} from "@/src/types/types.ts";
import {DateTime, Settings} from 'luxon';

Settings.setZone = 'America/Los_Angeles'

const apiAdapter: AxiosInstance = Axios.create({
  baseURL: process.env.TS_DEV_API_URL,
  headers: {
    Authorization: `Service ${process.env.TS_SERVICE_TOKEN_KEY}:${process.env.TS_SERVICE_TOKEN_SECRET}`,
  },
  paramsSerializer: params => Qs.stringify(params, {arrayFormat: 'repeat'})
});

export const getPatientInfo = async (patientInfo: PatientInfo) => {
  const {data: {patients}} = await apiAdapter.get(`/testorg2025q2/patients/search`, {
    params: {
      memberId: patientInfo.memberId,
      orgResourceId: 'testorg2025q2',
      fields: 'uuid name'
    }
  }).then(res => res);
  console.log(patients);
  if (patients) {
    const patient = patients[0];
    console.log('Patient found:', patient);
    const fullName = `${patient.name.firstName} ${patient.name.lastName}`;

    // Return the patient info with the name added
    return {
      ...patientInfo,
      name: fullName,
      uuid: patient.uuid,
    };
  } else {
    throw new Error('Patient not found');
  }

}

// const body = {
//     "patientUuid": "p",
//     "itinerary": [
//         {
//             "pickupDateTime": "pd",
//             "pickup": {
//                 "longLat": [1, 2],
//                 "addressText": "address"
//             },
//             "dropOff": {
//                 "longLat": [1, 2],
//                 "addressText": "address"
//             },
//             "appointmentReasons": [
//                 {
//                     "uuid": "reasonUuid",
//                     "displayText": "text",
//                     "classifications": []
//                 }
//             ],
//             "serviceInfo": {
//                 "levelOfService": {
//                     "uuid": "losUuid",
//                     "displayText": "text"
//                 }
//             },
//             "bookingType": "SCHEDULED"
//         }
//     ]
// }

export async function createTrip(bookingInfo: BookingInfo) {
  const {data: {appointmentReasons}} = await apiAdapter.get(`/testorg2025q2/config/appointment-reasons`);
  const {data: {levelsOfService}} = await apiAdapter.get(`/testorg2025q2/config/level-of-service`);

  const appointmentReason = appointmentReasons.find((reason: {
    displayText: string;
  }) => reason.displayText.toLowerCase() === bookingInfo.itinerary.appointmentReasons.toLowerCase());
  const levelOfService = levelsOfService.find((reason: {
    displayText: string;
  }) => reason.displayText.toLowerCase() === bookingInfo.itinerary.levelOfService.toLowerCase());

  console.log({appointmentReason, levelOfService})

  const requestBody = {
    "patientUuid": bookingInfo.patientInfo.uuid,
    "itinerary": [
      {
        "pickupDateTime": DateTime.fromISO(bookingInfo.itinerary.pickupDateTime, {zone: 'America/Los_Angeles'}).toUTC().toISO(),
        "pickup": bookingInfo.itinerary.pickup,
        "dropOff": bookingInfo.itinerary.dropOff,
        "appointmentReasons": [
          {
            "uuid": appointmentReason?.uuid,
            "displayText": appointmentReason?.displayText,
            "classifications": []
          }
        ],
        "serviceInfo": {
          "levelOfService": {
            "uuid": levelOfService?.uuid,
            "displayText": levelOfService?.displayText,
          }
        },
        "bookingType": "SCHEDULED",
        instructions: bookingInfo.itinerary.noteToDriver,
      }
    ],
    approvalRequest: {
      action: 'REQUEST_APPROVAL',
      body: {
        openingReason: {displayText: 'IVR booking test'}
      }
    }
  };
  const orgResourceId = 'testorg2025q2';
  const tripType = 'SCHEDULED';
  const externalOrigin = 'KINETIK_MA';

  if (levelOfService && appointmentReason) {
    const response =
      await apiAdapter.post(
        `/${orgResourceId}/trips/itinerary/${tripType}/via-external-request-origin/${externalOrigin}`,
        requestBody
      );
    console.log(response)
  }
}

export function getTripsUuid() {
  (async () => {
    const result = await apiAdapter.get(`/hpsj/trips`, {
      params: {
        fields: 'uuid itineraryUuid',
        page: 1,
        limit: 5,
      }
    });

    console.log(result.data);
  })();
}
