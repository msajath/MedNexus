const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Models
const User = require('./models/User');
const Doctor = require('./models/Doctor');
const Appointment = require('./models/Appointment');
const Availability = require('./models/Availability');

dotenv.config();

const getRelativeDate = (daysOffset) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ──────────────────────────────────────────────
// Seed Data (matches frontend mockData.js)
// ──────────────────────────────────────────────

const users = [
  // Patients
  { name: 'Alex Johnson', email: 'alex@mednexus.com', password: 'password123', role: 'patient', phone: '+1 (555) 123-4567' },
  { name: 'Sarah Miller', email: 'sarah.miller@email.com', password: 'password123', role: 'patient' },
  { name: 'John Davis', email: 'john.davis@email.com', password: 'password123', role: 'patient' },
  { name: 'Emily Clark', email: 'emily.clark@email.com', password: 'password123', role: 'patient' },

  // Doctors
  { name: 'Dr. Richard James', email: 'richard.james@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc1.png' },
  { name: 'Dr. Emily Larson', email: 'emily.larson@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc2.png' },
  { name: 'Dr. Sarah Patel', email: 'sarah.patel@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc3.png' },
  { name: 'Dr. Christopher Lee', email: 'christopher.lee@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc4.png' },
  { name: 'Dr. Jennifer Garcia', email: 'jennifer.garcia@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc5.png' },
  { name: 'Dr. Andrew Williams', email: 'andrew.williams@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc6.png' },
  { name: 'Dr. Christopher Davis', email: 'christopher.davis@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc7.png' },
  { name: 'Dr. Timothy White', email: 'timothy.white@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc8.png' },
  { name: 'Dr. Ava Mitchell', email: 'ava.mitchell@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc9.png' },
  { name: 'Dr. Jeffrey King', email: 'jeffrey.king@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc10.png' },
  { name: 'Dr. Zoe Kelly', email: 'zoe.kelly@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc11.png' },
  { name: 'Dr. Patrick Harris', email: 'patrick.harris@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc12.png' },
  { name: 'Dr. Chloe Evans', email: 'chloe.evans@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc13.png' },
  { name: 'Dr. Ryan Martinez', email: 'ryan.martinez@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc14.png' },
  { name: 'Dr. Amelia Hill', email: 'amelia.hill@mednexus.com', password: 'password123', role: 'doctor', isVerified: true, avatar: '/images/doc15.png' },

  // Admin
  { name: 'Admin User', email: 'admin@mednexus.com', password: 'password123', role: 'admin' },
];


const doctorProfiles = [
  {
    email: 'richard.james@mednexus.com',
    profile: {
      specialty: 'General physician',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Colombo, WP',
      available: false,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'emily.larson@mednexus.com',
    profile: {
      specialty: 'Gynecologist',
      fee: 60,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '3 Years',
      location: 'Kandy, CP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'sarah.patel@mednexus.com',
    profile: {
      specialty: 'Dermatologist',
      fee: 30,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '1 Years',
      location: 'Galle, SP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'christopher.lee@mednexus.com',
    profile: {
      specialty: 'Pediatricians',
      fee: 40,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '2 Years',
      location: 'Jaffna, NP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'jennifer.garcia@mednexus.com',
    profile: {
      specialty: 'Neurologist',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Negombo, WP',
      available: false,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'andrew.williams@mednexus.com',
    profile: {
      specialty: 'Neurologist',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Kurunegala, NWP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'christopher.davis@mednexus.com',
    profile: {
      specialty: 'General physician',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Gampaha, WP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'timothy.white@mednexus.com',
    profile: {
      specialty: 'Gynecologist',
      fee: 60,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '3 Years',
      location: 'Colombo, WP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'ava.mitchell@mednexus.com',
    profile: {
      specialty: 'Dermatologist',
      fee: 30,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '1 Years',
      location: 'Kandy, CP',
      available: false,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'jeffrey.king@mednexus.com',
    profile: {
      specialty: 'Pediatricians',
      fee: 40,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '2 Years',
      location: 'Galle, SP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'zoe.kelly@mednexus.com',
    profile: {
      specialty: 'Neurologist',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Jaffna, NP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'patrick.harris@mednexus.com',
    profile: {
      specialty: 'Neurologist',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Negombo, WP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'chloe.evans@mednexus.com',
    profile: {
      specialty: 'General physician',
      fee: 50,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '4 Years',
      location: 'Kurunegala, NWP',
      available: false,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'ryan.martinez@mednexus.com',
    profile: {
      specialty: 'Gynecologist',
      fee: 60,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '3 Years',
      location: 'Gampaha, WP',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
  {
    email: 'amelia.hill@mednexus.com',
    profile: {
      specialty: 'Dermatologist',
      fee: 30,
      rating: 4.8,
      reviews: Math.floor(Math.random() * 200) + 50,
      experience: '1 Years',
      location: 'New York, NY',
      available: true,
      languages: ['English'],
      bio: 'Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. Davis has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.',
    },
  },
];


const defaultAvailability = [
  { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
  { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
  { day: 'Saturday', enabled: false, start: '10:00', end: '13:00' },
  { day: 'Sunday', enabled: false, start: '', end: '' },
];

// ──────────────────────────────────────────────
// Seed Function
// ──────────────────────────────────────────────
const seedDB = async () => {
  try {
    await connectDB();

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Doctor.deleteMany({});
    await Appointment.deleteMany({});
    await Availability.deleteMany({});

    // Create users
    console.log('👤 Creating users...');
    const createdUsers = {};
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers[userData.email] = user;
      console.log(`   ✅ ${user.role}: ${user.name} (${user.email})`);
    }

    // Create doctor profiles
    console.log('\n🩺 Creating doctor profiles...');
    const createdDoctors = {};
    for (const dp of doctorProfiles) {
      const user = createdUsers[dp.email];
      const doctor = await Doctor.create({
        user: user._id,
        ...dp.profile,
      });
      createdDoctors[dp.email] = doctor;
      console.log(`   ✅ ${user.name} — ${dp.profile.specialty}`);

      // Create availability
      await Availability.create({
        doctor: doctor._id,
        schedule: defaultAvailability,
      });
    }

    // Create sample appointments
    console.log('\n📅 Creating sample appointments...');
    const appointmentData = [
      {
        patient: createdUsers['alex@mednexus.com']._id,
        doctor: createdDoctors['richard.james@mednexus.com']._id,
        date: getRelativeDate(0),
        time: '10:00 AM',
        status: 'confirmed',
        type: 'Follow-up',
        notes: 'Regular check-up for heart condition monitoring.',
      },
      {
        patient: createdUsers['alex@mednexus.com']._id,
        doctor: createdDoctors['emily.larson@mednexus.com']._id,
        date: getRelativeDate(-2),
        time: '2:30 PM',
        status: 'confirmed',
        type: 'Consultation',
        notes: 'Annual physical examination.',
      },
      {
        patient: createdUsers['alex@mednexus.com']._id,
        doctor: createdDoctors['sarah.patel@mednexus.com']._id,
        date: getRelativeDate(-5),
        time: '11:00 AM',
        status: 'cancelled',
        type: 'Check-up',
        notes: 'Cancelled due to personal emergency.',
      },
      {
        patient: createdUsers['alex@mednexus.com']._id,
        doctor: createdDoctors['christopher.lee@mednexus.com']._id,
        date: getRelativeDate(2),
        time: '9:00 AM',
        status: 'pending',
        type: 'New Consultation',
        notes: 'First appointment for skin evaluation.',
      },
      {
        patient: createdUsers['alex@mednexus.com']._id,
        doctor: createdDoctors['richard.james@mednexus.com']._id,
        date: getRelativeDate(5),
        time: '3:00 PM',
        status: 'confirmed',
        type: 'Follow-up',
        notes: 'Post-surgery follow-up visit.',
      },
      // Doctor view appointments (patients booking with Dr. Sterling)
      {
        patient: createdUsers['sarah.miller@email.com']._id,
        doctor: createdDoctors['jennifer.garcia@mednexus.com']._id,
        date: getRelativeDate(0),
        time: '09:00 AM',
        status: 'confirmed',
        type: 'General Check-up',
        notes: 'Patient reports dull aching in the lumbar region for 3 weeks.',
      },
      {
        patient: createdUsers['john.davis@email.com']._id,
        doctor: createdDoctors['jennifer.garcia@mednexus.com']._id,
        date: getRelativeDate(0),
        time: '10:30 AM',
        status: 'confirmed',
        type: 'Follow-up',
        notes: 'Regular follow-up for hypertensive heart disease.',
      },
      {
        patient: createdUsers['emily.clark@email.com']._id,
        doctor: createdDoctors['jennifer.garcia@mednexus.com']._id,
        date: getRelativeDate(0),
        time: '02:00 PM',
        status: 'cancelled',
        type: 'Consultation',
        notes: 'Appointment cancelled by patient.',
      },
    ];

    for (const appt of appointmentData) {
      await Appointment.create(appt);
    }
    console.log(`   ✅ Created ${appointmentData.length} sample appointments`);

    // Summary
    console.log('\n══════════════════════════════════════════');
    console.log('🎉 Database seeded successfully!');
    console.log('══════════════════════════════════════════');
    console.log(`   Users:        ${users.length}`);
    console.log(`   Doctors:      ${doctorProfiles.length}`);
    console.log(`   Appointments: ${appointmentData.length}`);
    console.log('══════════════════════════════════════════');
    console.log('\n🔑 Login credentials:');
    console.log('   Patient:  alex@mednexus.com / password123');
    console.log('   Doctor:   richard.james@mednexus.com / password123');
    console.log('   Admin:    admin@mednexus.com / password123');
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDB();
