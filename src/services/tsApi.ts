import Qs from 'qs';
import Axios, { AxiosInstance } from 'axios';
import { BookingInfo, PatientInfo, TripManagementInfo, Trip } from "@/src/types/types.ts";
import { DateTime, Settings } from 'luxon';
import { sendActualEmail } from './email';

Settings.defaultZone = 'America/New_York';

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
      fields: 'uuid name contactInfo'
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
      email: patient.contactInfo?.email,
    };
  } else {
    throw new Error('Patient not found');
  }

}

export async function createTrip(bookingInfo: BookingInfo) {
  const { data: { appointmentReasons } } = await apiAdapter.get(`/${orgResourceId}/config/appointment-reasons`);
  const { data: { levelsOfService } } = await apiAdapter.get(`/${orgResourceId}/config/level-of-service`);

  // todo: add necessary reasons and levels of service in TS
  // todo: add some patients in TS
  // todo: look into the voice input abrupt stop
  const appointmentReason = appointmentReasons.find((reason: {
    displayText: string;
  }) => reason.displayText.toLowerCase() === bookingInfo.itinerary.appointmentReasons.toLowerCase())
    || appointmentReasons.find((reason: {
      displayText: string;
    }) => reason.displayText.toLowerCase() === 'general');
  const levelOfService = levelsOfService.find((reason: {
    displayText: string;
  }) => reason.displayText.toLowerCase() === bookingInfo.itinerary.levelOfService.toLowerCase())
    || levelsOfService.find((reason: {
      displayText: string;
    }) => reason.displayText.toLowerCase() === 'general');

  console.log({ appointmentReason, levelOfService })

  let pickup = bookingInfo.itinerary.pickup;
  let dropOff = bookingInfo.itinerary.dropOff;

  if (pickup.longLat[0] === 0 && pickup.longLat[1] === 0) {
    const { data: { results } } = await apiAdapter.get(`/proxy/google-maps/geocode/json`, {
      params: {
        address: pickup.addressText,
      }
    });
    if (results && results.length > 0) {
      try {
        const location = results[0].geometry.location;
        pickup = {
          ...pickup,
          longLat: [location.lng, location.lat],
          addressText: results[0].formatted_address,
        };
      } catch (error) {
        console.log('Pickup Error parsing Google Maps response:', error);
      }
    }
  }
  if (dropOff.longLat[0] === 0 && dropOff.longLat[1] === 0) {
    const { data: { results } } = await apiAdapter.get(`/proxy/google-maps/geocode/json`, {
      params: {
        address: dropOff.addressText,
      }
    });
    if (results && results.length > 0) {
      try {
        const location = results[0].geometry.location;
        dropOff = {
          ...dropOff,
          longLat: [location.lng, location.lat],
          addressText: results[0].formatted_address,
        };
      } catch (error) {
        console.log('Dropoff Error parsing Google Maps response:', error);
      }
    }
  }

  const requestBody = {
    "patientUuid": bookingInfo.patientInfo.uuid,
    "itinerary": [
      {
        "pickupDateTime": DateTime.fromISO(bookingInfo.itinerary.pickupDateTime, { zone: 'America/New_York' }).toUTC().toISO(),
        "pickup": pickup,
        "dropOff": dropOff,
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
    return response.jobUuid;
  }
}

export async function pullJob(patientInfo: PatientInfo, jobUuid: string) {
  setTimeout(async () => {
    const { data: { jobs } } = await apiAdapter.get(`/${orgResourceId}/trip-jobs?uuid=${jobUuid}`);
    if (!jobs || jobs.length === 0) {
      throw new Error('Job not found');
    }
    const job = jobs[0];
    if (job.status === 'SUCCESS') {
      const trip = job.result.itinerary[0];
      const info = {
        patientName: patientInfo.name,
        confirmationNumber: trip.confirmationNumber,
        status: trip.status,
        statusText: trip.statusText,
        pickupAddress: trip.request.pickup.addressText,
        dropOffAddress: trip.request.dropOff.addressText,
        pickupDateTime: trip.request.pickupDateTime,
        dropOffDateTime: trip.request.dropOffDateTime,
        appointmentReason: trip.request.appointmentReasons[0].displayText,
        levelOfService: trip.request.serviceInfo.levelOfService.displayText,
      };
      const text = `
        Trip Confirmation Details:
        Confirmation Number: ${info.confirmationNumber}
        Status: ${info.status},
        Status Text: ${info.statusText},
        Patient Name: ${info.patientName}
        Pickup Address: ${info.pickupAddress}
        Drop-off Address: ${info.dropOffAddress}
        Pickup Date and Time: ${info.pickupDateTime}
        DropOff Date and Time: ${info.dropOffDateTime}
        Appointment Reasons: ${info.appointmentReason}
        Level of Service: ${info.levelOfService}
        `;
      await sendActualEmail(
        patientInfo.email || 'adrian@kinetik.care',
        text,
        patientInfo.name || 'Valued Customer',
        'Trip Request Confirmation'
      );
    } else if (job.status === 'ERROR') {
      await sendActualEmail(
        'abir@kinetik.care',
        'Trip Request Creation Error',
        patientInfo.name || 'Valued Customer',
        "Trip Request Creation Error"
      );
      // throw new Error('ERROR');
    }
  }, 30000);
}

export async function getTripData(query: TripManagementInfo) {
  const { data: { trips } } = await apiAdapter.get(`/${orgResourceId}/trips/search`, {
    params: {
      ...(query?.confirmationNumber && { confirmationNumber: query.confirmationNumber }),
      ...(query?.pickupDateTime && {
        pickupDateTime: DateTime.fromJSDate(query?.pickupDateTime, { zone: 'America/New_York' }).toUTC().toISO()
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
        pickupDateTime: DateTime.fromISO(trip.request.pickupDateTime, { zone: 'America/New_York' }).toJSDate(),
        dropOffDateTime: DateTime.fromISO(trip.request.dropOffDateTime, { zone: 'America/New_York' }).toJSDate(),
        appointmentReasons: trip.request.appointmentReasons[0],
        levelOfService: trip.request.serviceInfo.levelOfService,
        noteToDriver: trip.request.instructions
      }
    } as Trip;
  }
  return null;
}
