// services/appointmentService.js
const mongoose = require('mongoose');

// Define Appointment Schema
const appointmentSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  userId: { type: String, required: true },
  dateTime: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'confirmed', 'cancelled', 'completed'], default: 'scheduled' },
  notes: { type: String },
  userPhone: { type: String, required: true },
  userName: { type: String, required: true }
}, { timestamps: true });

// Create Appointment Model if it doesn't exist
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);

class AppointmentService {

  async createAppointment(appointmentData) {
    try {
      // Validate appointment data
      if (!appointmentData.propertyId) {
        throw new Error('Property ID is required');
      }
      
      if (!appointmentData.userName || !appointmentData.userPhone) {
        throw new Error('User information is incomplete');
      }
      
      if (!appointmentData.dateTime) {
        throw new Error('Appointment date and time are required');
      }
      
      // Create appointment with default status if not provided
      const appointmentToCreate = {
        ...appointmentData,
        status: appointmentData.status || 'scheduled',
        createdAt: new Date()
      };
      
      const appointment = new Appointment(appointmentToCreate);
      await appointment.validate();
      await appointment.save();
      
      // Send confirmation notifications
      await this.sendAppointmentConfirmation(appointment);
      
      return appointment;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  // Send appointment confirmation to user and notify internal team
  async sendAppointmentConfirmation(appointment) {
    try {
      // Log confirmation for now (in a real system, this would send actual notifications)
      console.log(`Sending appointment confirmation to user: ${appointment.userName} (${appointment.userPhone})`);
      console.log(`Appointment ID: ${appointment._id}`);
      console.log(`Property ID: ${appointment.propertyId}`);
      console.log(`Date/Time: ${appointment.dateTime}`);
      
      // In a production system, this would:
      // 1. Send WhatsApp confirmation to user
      // 2. Send email notification to sales team
      // 3. Update CRM system
      // 4. Schedule reminder notifications
      
      return true;
    } catch (error) {
      console.error('Error sending appointment confirmation:', error);
      // Don't throw the error - we don't want to fail the appointment creation
      // just because notifications failed
      return false;
    }
  }

  async getAppointment(appointmentId) {
    try {
      const appointment = await Appointment.findById(appointmentId).populate('propertyId');
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      return appointment;
    } catch (error) {
      console.error('Error getting appointment:', error);
      throw error;
    }
  }

  async updateAppointmentStatus(appointmentId, status, notes = '') {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { status, notes, updatedAt: new Date() },
        { new: true }
      );

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      return appointment;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  async getAppointmentsByPhone(phoneNumber) {
    try {
      const appointments = await Appointment.find({ userPhone: phoneNumber })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('propertyId');

      return appointments;
    } catch (error) {
      console.error('Error getting appointments by phone:', error);
      throw error;
    }
  }

  async getAppointmentsByProperty(propertyId) {
    try {
      const appointments = await Appointment.find({ propertyId })
        .sort({ createdAt: -1 })
        .populate('propertyId');

      return appointments;
    } catch (error) {
      console.error('Error getting appointments by property:', error);
      throw error;
    }
  }

  async getAllAppointments(limit = 50, status = null) {
    try {
      let query = this.db.collection(this.appointmentsCollection)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();
      const appointments = [];
      
      snapshot.forEach(doc => {
        appointments.push({ id: doc.id, ...doc.data() });
      });

      return appointments;
    } catch (error) {
      console.error('Error getting all appointments:', error);
      throw error;
    }
  }

  // User data is now stored in the Appointment model itself

  async getUserData(phoneNumber) {
    try {
      const latestAppointment = await Appointment.findOne({ userPhone: phoneNumber })
        .sort({ createdAt: -1 });
      
      if (latestAppointment) {
        return {
          name: latestAppointment.userName,
          phone: latestAppointment.userPhone
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  // Get appointments for today
  async getTodaysAppointments() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const appointments = await Appointment.find({
        dateTime: { $gte: today, $lt: tomorrow },
        status: 'scheduled'
      }).populate('propertyId');

      return appointments;
    } catch (error) {
      console.error('Error getting today\'s appointments:', error);
      throw error;
    }
  }

  // Cancel appointment
  async cancelAppointment(appointmentId, reason = '') {
    try {
      await this.updateAppointmentStatus(appointmentId, 'cancelled', `Cancelled: ${reason}`);
      return true;
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  }

  // Confirm appointment
  async confirmAppointment(appointmentId, confirmedDateTime = null) {
    try {
      const updateData = {
        status: 'confirmed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (confirmedDateTime) {
        updateData.confirmedDateTime = confirmedDateTime;
      }

      await this.db.collection(this.appointmentsCollection)
        .doc(appointmentId)
        .update(updateData);

      return true;
    } catch (error) {
      console.error('Error confirming appointment:', error);
      throw error;
    }
  }

  // Mark appointment as completed
  async completeAppointment(appointmentId, feedback = '') {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        {
          status: 'completed',
          feedback: feedback || undefined,
          completedAt: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      return appointment;
    } catch (error) {
      console.error('Error completing appointment:', error);
      throw error;
    }
  }

  // Get appointment statistics
  async getAppointmentStats() {
    try {
      const [total, scheduled, confirmed, completed, cancelled] = await Promise.all([
        Appointment.countDocuments(),
        Appointment.countDocuments({ status: 'scheduled' }),
        Appointment.countDocuments({ status: 'confirmed' }),
        Appointment.countDocuments({ status: 'completed' }),
        Appointment.countDocuments({ status: 'cancelled' })
      ]);

      return {
        total,
        scheduled,
        confirmed,
        completed,
        cancelled
      };
    } catch (error) {
      console.error('Error getting appointment stats:', error);
      throw error;
    }
  }

  // Validate appointment data
  static validateAppointmentData(data) {
    const required = [
      'propertyId',
      'userName',
      'userPhone',
      'dateTime'
    ];

    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required appointment fields: ${missing.join(', ')}`);
    }

    // Validate email format if provided
    if (data.customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.customerEmail)) {
        throw new Error('Invalid email format');
      }
    }

    // Validate phone number format
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(data.customerPhone)) {
      throw new Error('Invalid phone number format');
    }

    return true;
  }
}

module.exports = AppointmentService;