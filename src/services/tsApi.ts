import Qs from 'qs';
import Axios, { AxiosInstance } from 'axios';
import { BookingInfo, PatientInfo, TripManagementInfo, Trip } from "@/src/types/types.ts";
import { DateTime, Settings } from 'luxon';
import { log } from 'console';

Settings.defaultZone = 'America/Los_Angeles';

const orgResourceId = 'testorg2025q2';

const apiAdapter: AxiosInstance = Axios.create({
  baseURL: process.env.TS_DEV_API_URL,
  headers: {
    Authorization: `Service ${process.env.TS_SERVICE_TOKEN_KEY}:${process.env.TS_SERVICE_TOKEN_SECRET}`,
  },
  paramsSerializer: params => Qs.stringify(params, { arrayFormat: 'repeat' })
});

export const getPatientInfo = async (patientInfo: PatientInfo) => {
  const { data: { patients } } = await apiAdapter.get(`/${orgResourceId}/patients/search`, {
    params: {
      memberId: patientInfo.memberId,
      orgResourceId,
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

export async function createTrip(bookingInfo: BookingInfo) {
  const { data: { appointmentReasons } } = await apiAdapter.get(`/${orgResourceId}/config/appointment-reasons`);
  const { data: { levelsOfService } } = await apiAdapter.get(`/${orgResourceId}/config/level-of-service`);

  const appointmentReason = appointmentReasons.find((reason: {
    displayText: string;
  }) => reason.displayText.toLowerCase() === bookingInfo.itinerary.appointmentReasons.toLowerCase());
  const levelOfService = levelsOfService.find((reason: {
    displayText: string;
  }) => reason.displayText.toLowerCase() === bookingInfo.itinerary.levelOfService.toLowerCase());

  console.log({ appointmentReason, levelOfService })

  const requestBody = {
    "patientUuid": bookingInfo.patientInfo.uuid,
    "itinerary": [
      {
        "pickupDateTime": DateTime.fromISO(bookingInfo.itinerary.pickupDateTime, { zone: 'America/Los_Angeles' }).toUTC().toISO(),
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
        openingReason: { displayText: 'IVR booking test' }
      }
    }
  };
  const tripType = 'SCHEDULED';
  const externalOrigin = 'KINETIK_MA';

  if (levelOfService && appointmentReason) {
    const { data: response } =
      await apiAdapter.post(
        `/${orgResourceId}/trips/itinerary/${tripType}/via-external-request-origin/${externalOrigin}`,
        requestBody
      );
    console.log(response)

    setInterval(async () => {
      const job = await apiAdapter.get(`/${orgResourceId}/trip-jobs/${response.jobUuid}`);
      console.log(job.data);
    }, 7500);
  }
}

export async function getTripData(query: TripManagementInfo) {
  const { data: { trips } } = await apiAdapter.get(`/${orgResourceId}/trips/search`, {
    params: {
      ...(query?.confirmationNumber && { confirmationNumber: query.confirmationNumber }),
      ...(query?.pickupDateTime && {
        pickupDateTime: DateTime.fromJSDate(query?.pickupDateTime, { zone: 'America/Los_Angeles' }).toUTC().toISO()
      }),
      'requester.orgResourceId': orgResourceId,
      page: 1,
      limit: 5,
    }
  });
  if (trips && trips.length > 0) {
    const trip = trips[0];
    return {
      uuid: trip.uuid,
      itineraryUuid: trip.itineraryUuid,
      confirmationNumber: trip.confirmationNumber,
      request: {
        pickup: trip.request.pickup,
        dropOff: trip.request.dropOff,
        pickupDateTime: DateTime.fromISO(trip.request.pickupDateTime, { zone: 'America/Los_Angeles' }).toJSDate(),
        dropOffDateTime: DateTime.fromISO(trip.request.dropOffDateTime, { zone: 'America/Los_Angeles' }).toJSDate(),
        appointmentReasons: trip.request.appointmentReasons[0],
        levelOfService: trip.request.serviceInfo.levelOfService,
        noteToDriver: trip.request.instructions
      }
    } as Trip;
  }
  return null;
}
