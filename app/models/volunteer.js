const mongoose = require('mongoose')

const volunteerSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  skills: {
    type: String,
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Volunteer', volunteerSchema)