// services/appointmentService.js
const mongoose = require("mongoose");
const WhatsAppService = require("./whatsappService");
const GoogleSheetsService = require("./googleSheetsService");

// Define Appointment Schema
const appointmentSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    userId: { type: String, required: true },
    dateTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "cancelled", "completed"],
      default: "scheduled",
    },
    notes: { type: String },
    userPhone: { type: String, required: true },
    userName: { type: String, required: true },
  },
  { timestamps: true }
);

// Create Appointment Model if it doesn't exist
const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);

class AppointmentService {
  constructor() {
    this.whatsappService = new WhatsAppService();
    this.googleSheetsService = new GoogleSheetsService();
  }

  async createAppointment(appointmentData) {
    try {
      // Validate appointment data
      if (!appointmentData.propertyId) {
        throw new Error("Property ID is required");
      }

      if (!appointmentData.userName || !appointmentData.userPhone) {
        throw new Error("User information is incomplete");
      }

      if (!appointmentData.dateTime) {
        throw new Error("Appointment date and time are required");
      }

      // Create appointment with default status if not provided
      const appointmentToCreate = {
        ...appointmentData,
        status: appointmentData.status || "scheduled",
        createdAt: new Date(),
      };

      const appointment = new Appointment(appointmentToCreate);
      await appointment.validate();
      await appointment.save();

      // Send confirmation notifications
      await this.sendAppointmentConfirmation(appointment);

      return appointment;
    } catch (error) {
      console.error("Error creating appointment:", error);
      throw error;
    }
  }

  // Send appointment confirmation to user and notify internal team
  async sendAppointmentConfirmation(appointment) {
    try {
      console.log(
        `Sending appointment confirmation to user: ${appointment.userName} (${appointment.userPhone})`
      );

      // 1. Store data in Google Sheets
      await this.storeAppointmentInGoogleSheets(appointment);

      // 2. Send WhatsApp notification to sales team
      await this.notifySalesTeam(appointment);

      return true;
    } catch (error) {
      console.error("Error sending appointment confirmation:", error);
      // Don't throw the error - we don't want to fail the appointment creation
      // just because notifications failed
      return false;
    }
  }

  // Store appointment data in Google Sheets
  async storeAppointmentInGoogleSheets(appointment) {
    try {
      // Populate property details if needed
      let populatedAppointment = appointment;
      if (!appointment.propertyId.name) {
        populatedAppointment = await Appointment.findById(
          appointment._id
        ).populate("propertyId");
      }

      // Prepare data for Google Sheets
      const appointmentData = {
        userName: populatedAppointment.userName,
        userPhone: populatedAppointment.userPhone,
        dateTime: populatedAppointment.dateTime,
        purpose: populatedAppointment.propertyId
          ? `${populatedAppointment.propertyId.title} ${populatedAppointment.propertyId.type} - ${populatedAppointment.propertyId.subType}`
          : "Property Visit",
        language: populatedAppointment.language || "English",
        source: "WhatsApp Bot",
        status: populatedAppointment.status,
      };

      // Append data to Google Sheets
      const result = await this.googleSheetsService.appendAppointmentData(
        appointmentData
      );

      if (result.success) {
        console.log(
          `Appointment data stored in Google Sheets (${result.updatedCells} cells updated)`
        );
        return true;
      } else {
        // Handle different error types
        switch (result.errorType) {
          case "API_NOT_ENABLED":
            console.error(
              `Google Sheets API not enabled. Enable it at: ${result.enableUrl}`
            );
            break;
          case "PERMISSION_DENIED":
            console.error(
              "Google Sheets permission denied. Check service account permissions."
            );
            break;
          case "SHEET_NOT_FOUND":
            console.error(
              "Google Sheet or tab not found. Check spreadsheet ID and sheet name."
            );
            break;
          case "CONFIG_ERROR":
            console.error(
              "Google Sheets configuration error:",
              result.error?.message || "Unknown config error"
            );
            break;
          default:
            console.error(
              "Failed to store appointment data in Google Sheets:",
              result.error?.message || "Unknown error"
            );
        }

        // Log the appointment data locally as a backup
        this.logAppointmentLocally(appointmentData);
        return false;
      }
    } catch (error) {
      console.error("Error storing appointment in Google Sheets:", error);
      // Log the appointment data locally as a backup
      this.logAppointmentLocally(appointment);
      return false;
    }
  }

  // Backup method to log appointment data locally when Google Sheets fails
  logAppointmentLocally(appointmentData) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        appointmentId: appointmentData._id || "Unknown",
        userName: appointmentData.userName || "Unknown",
        userPhone: appointmentData.userPhone || "Unknown",
        dateTime: appointmentData.dateTime
          ? new Date(appointmentData.dateTime).toISOString()
          : "Unknown",
        status: appointmentData.status || "Unknown",
      };

      console.log("APPOINTMENT_DATA_BACKUP:", JSON.stringify(logEntry));
      // In a production environment, you might want to write this to a local file
      // or a backup database to ensure the data is not lost
    } catch (error) {
      console.error("Error logging appointment data locally:", error);
    }
  }

  // Send WhatsApp notification to sales team
  async notifySalesTeam(appointment) {
    try {
      const salesTeamNumber = `whatsapp:${process.env.SALES_TEAM_WHATSAPP_NUMBER}`;
      if (!salesTeamNumber) {
        console.warn(
          "Sales team WhatsApp number not configured. Set SALES_TEAM_WHATSAPP_NUMBER in .env file."
        );
        return false;
      }

      // Always get fresh property info
      const populatedAppointment = await Appointment.findById(appointment._id)
        .populate("propertyId")
        .lean();

      const property = populatedAppointment.propertyId;
      const dateTime = new Date(populatedAppointment.dateTime);

      // Format date and time nicely
      const visitDate = dateTime.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const visitTime = dateTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      // Build a neat property summary
      const propertyDetails = `🏢 *${property.title}*
📍 ${property.location}
📏 ${property.carpetArea?.value || "-"} ${property.carpetArea?.unit || ""}
💰 ₹${property.price.toLocaleString()}
🔑 ${property.forSale ? "For Sale" : property.forLease ? "For Lease" : ""}
`;

      // Final message in a neat template
      const message = `🔔 *New Site Visit Scheduled!*

👤 *Name:* ${populatedAppointment.userName}
📞 *Contact:* ${populatedAppointment.userPhone}
📅 *Visit:* ${visitDate} at ${visitTime}

${propertyDetails.trim()}

🗒️ *Notes:* ${populatedAppointment.notes || "N/A"}
📲 *Source:* WhatsApp Bot (FB/IG)

✅ Please connect and confirm the visit.

— MALPURE GROUP BOT`;

      await this.whatsappService.sendMessage(salesTeamNumber, message);
      console.log(`Sales team notification sent to ${salesTeamNumber}`);
      return true;
    } catch (error) {
      console.error("Error in sales team notification process:", error);
      return false;
    }
  }

  // Helper method to get month name
  getMonthName(monthIndex) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[monthIndex];
  }

  async getAppointment(appointmentId) {
    try {
      const appointment = await Appointment.findById(appointmentId).populate(
        "propertyId"
      );

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      return appointment;
    } catch (error) {
      console.error("Error getting appointment:", error);
      throw error;
    }
  }

  async updateAppointmentStatus(appointmentId, status, notes = "") {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { status, notes, updatedAt: new Date() },
        { new: true }
      );

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      return appointment;
    } catch (error) {
      console.error("Error updating appointment:", error);
      throw error;
    }
  }

  async getAppointmentsByPhone(phoneNumber) {
    try {
      const appointments = await Appointment.find({ userPhone: phoneNumber })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("propertyId");

      return appointments;
    } catch (error) {
      console.error("Error getting appointments by phone:", error);
      throw error;
    }
  }

  async getAppointmentsByProperty(propertyId) {
    try {
      const appointments = await Appointment.find({ propertyId })
        .sort({ createdAt: -1 })
        .populate("propertyId");

      return appointments;
    } catch (error) {
      console.error("Error getting appointments by property:", error);
      throw error;
    }
  }

  async getAllAppointments(limit = 50, status = null) {
    try {
      let query = this.db
        .collection(this.appointmentsCollection)
        .orderBy("createdAt", "desc")
        .limit(limit);

      if (status) {
        query = query.where("status", "==", status);
      }

      const snapshot = await query.get();
      const appointments = [];

      snapshot.forEach((doc) => {
        appointments.push({ id: doc.id, ...doc.data() });
      });

      return appointments;
    } catch (error) {
      console.error("Error getting all appointments:", error);
      throw error;
    }
  }

  // User data is now stored in the Appointment model itself

  async getUserData(phoneNumber) {
    try {
      const latestAppointment = await Appointment.findOne({
        userPhone: phoneNumber,
      }).sort({ createdAt: -1 });

      if (latestAppointment) {
        return {
          name: latestAppointment.userName,
          phone: latestAppointment.userPhone,
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting user data:", error);
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
        status: "scheduled",
      }).populate("propertyId");

      return appointments;
    } catch (error) {
      console.error("Error getting today's appointments:", error);
      throw error;
    }
  }

  // Cancel appointment
  async cancelAppointment(appointmentId, reason = "") {
    try {
      await this.updateAppointmentStatus(
        appointmentId,
        "cancelled",
        `Cancelled: ${reason}`
      );
      return true;
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      throw error;
    }
  }

  // Confirm appointment
  async confirmAppointment(appointmentId, confirmedDateTime = null) {
    try {
      const updateData = {
        status: "confirmed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (confirmedDateTime) {
        updateData.confirmedDateTime = confirmedDateTime;
      }

      await this.db
        .collection(this.appointmentsCollection)
        .doc(appointmentId)
        .update(updateData);

      return true;
    } catch (error) {
      console.error("Error confirming appointment:", error);
      throw error;
    }
  }

  // Mark appointment as completed
  async completeAppointment(appointmentId, feedback = "") {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        {
          status: "completed",
          feedback: feedback || undefined,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      return appointment;
    } catch (error) {
      console.error("Error completing appointment:", error);
      throw error;
    }
  }

  // Get appointment statistics
  async getAppointmentStats() {
    try {
      const [total, scheduled, confirmed, completed, cancelled] =
        await Promise.all([
          Appointment.countDocuments(),
          Appointment.countDocuments({ status: "scheduled" }),
          Appointment.countDocuments({ status: "confirmed" }),
          Appointment.countDocuments({ status: "completed" }),
          Appointment.countDocuments({ status: "cancelled" }),
        ]);

      return {
        total,
        scheduled,
        confirmed,
        completed,
        cancelled,
      };
    } catch (error) {
      console.error("Error getting appointment stats:", error);
      throw error;
    }
  }

  // Validate appointment data
  static validateAppointmentData(data) {
    const required = ["propertyId", "userName", "userPhone", "dateTime"];

    const missing = required.filter((field) => !data[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required appointment fields: ${missing.join(", ")}`
      );
    }

    // Validate email format if provided
    if (data.customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.customerEmail)) {
        throw new Error("Invalid email format");
      }
    }

    // Validate phone number format
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(data.customerPhone)) {
      throw new Error("Invalid phone number format");
    }

    return true;
  }
}

module.exports = AppointmentService;
