import { BookingInfo } from '../../types/types.ts';

interface BookingDetailsCardProps {
  bookingInfo: BookingInfo;
  onStartNew: () => void;
}

interface DetailItemProps {
  label: string;
  value: string;
}

const DetailItem = ({ label, value }: DetailItemProps) => (
  <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-slate-400">{label}</dt>
    <dd className="mt-1 text-sm text-slate-200 sm:mt-0 sm:col-span-2">{value || 'Not specified'}</dd>
  </div>
);

const BookingDetailsCard = ({ bookingInfo, onStartNew }: BookingDetailsCardProps) => {
  return (
    <div className="bg-slate-800 shadow-2xl rounded-xl overflow-hidden w-full max-w-lg p-6 mt-6 border border-slate-700">
      <h3 className="text-2xl font-semibold leading-7 text-sky-400 mb-6 text-center">Booking Confirmation</h3>
      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700">
          <DetailItem label="MemberId" value={bookingInfo.patientInfo.memberId} />
          <DetailItem label="Pickup Location" value={bookingInfo.itinerary.pickup.addressText} />
          <DetailItem label="Dropoff Location" value={bookingInfo.itinerary.dropOff.addressText} />
          <DetailItem label="Date" value={bookingInfo.itinerary.pickupDateTime.toString()} />
          <DetailItem label="Appointment Reason" value={bookingInfo.itinerary.appointmentReasons} />
          <DetailItem label="Level Of Service" value={bookingInfo.itinerary.levelOfService} />
          <DetailItem label="Medical Needs" value={bookingInfo.itinerary.medicalNeeds} />
          <DetailItem label="Companion" value={bookingInfo.itinerary.companions ? 'Yes' : 'No'} />
        </dl>
      </div>
      <div className="mt-8 text-center">
        <button
          onClick={onStartNew}
          className="px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
        >
          Start New Booking
        </button>
      </div>
    </div>
  );
};

export default BookingDetailsCard;