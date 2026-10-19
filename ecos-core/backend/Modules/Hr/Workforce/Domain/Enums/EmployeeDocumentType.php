<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Enums;

/** What a document attached to an employee is. */
enum EmployeeDocumentType: string
{
    case Contract = 'contract';
    case NationalId = 'national_id';
    case Passport = 'passport';
    case Certificate = 'certificate';
    case Qualification = 'qualification';
    case MedicalCertificate = 'medical_certificate';
    case WorkPermit = 'work_permit';
    case DrivingLicence = 'driving_licence';
    case Other = 'other';

    /** Documents that lapse and need watching for renewal. */
    public function expires(): bool
    {
        return in_array($this, [
            self::NationalId, self::Passport, self::MedicalCertificate,
            self::WorkPermit, self::DrivingLicence,
        ], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Contract => 'Contract',
            self::NationalId => 'National ID',
            self::Passport => 'Passport',
            self::Certificate => 'Certificate',
            self::Qualification => 'Qualification',
            self::MedicalCertificate => 'Medical Certificate',
            self::WorkPermit => 'Work Permit',
            self::DrivingLicence => 'Driving Licence',
            self::Other => 'Other',
        };
    }
}
