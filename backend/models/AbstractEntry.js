import mongoose from 'mongoose';

// Per-day manual overrides for the Monthly Abstract grid.
// Today only `convert_value` is editable, but the schema stores a free
// map (`manualValues`) so we can open more fields up later without a
// migration — just add another key and the GET-merge picks it up.
//
// Uniqueness on (client, date) keeps the row idempotent: saving a new
// value for a cell upserts the same document instead of creating
// duplicates. `date` is stored as the ISO YYYY-MM-DD string for
// stable equality matching with the abstract's row keys.
const abstractEntrySchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    manualValues: {
      type: Map,
      of: Number,
      default: {},
    },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

abstractEntrySchema.index({ client: 1, date: 1 }, { unique: true });

const AbstractEntry = mongoose.model('AbstractEntry', abstractEntrySchema);
export default AbstractEntry;
