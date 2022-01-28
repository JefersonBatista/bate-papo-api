import joi from "joi";

const participantSchema = joi.object({
  name: joi.string().required(),
});

function getMessageSchema(participants) {
  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi
      .string()
      .valid(...participants)
      .required(),
  });

  return messageSchema;
}

export { participantSchema, getMessageSchema };
