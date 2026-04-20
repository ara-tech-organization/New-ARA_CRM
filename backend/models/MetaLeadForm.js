import mongoose from 'mongoose';

const metaLeadFormSchema = new mongoose.Schema(
  {
    // Nullable — unmapped forms surface in the "unassigned" admin route.
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    page_id: { type: String, required: true, trim: true },
    form_id: { type: String, required: true, trim: true },
    name: { type: String, default: '' },
    status: { type: String, default: '' },
    locale: { type: String, default: '' },
    question_schema: {
      type: [
        {
          key: { type: String, default: '' },
          label: { type: String, default: '' },
          type: { type: String, default: '' },
          options: { type: [String], default: [] },
        },
      ],
      default: [],
    },
    leads_count: { type: Number, default: 0 },
    last_seen_at: { type: Date, default: Date.now },
    last_polled_at: { type: Date },
  },
  { timestamps: true }
);

metaLeadFormSchema.index({ form_id: 1 }, { unique: true });
metaLeadFormSchema.index({ client_id: 1 });
metaLeadFormSchema.index({ page_id: 1 });

const MetaLeadForm = mongoose.model('MetaLeadForm', metaLeadFormSchema);

export default MetaLeadForm;
