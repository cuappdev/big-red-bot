import { getModelForClass, index, prop } from "@typegoose/typegoose";

@index({ title: "text" })
class Form {
  constructor(
    title: string,
    ingestedDate: Date,
    dueDate: Date,
    formURL: string
  ) {
    // invariant: title is unique
    this.title = title;
    this.ingestedDate = ingestedDate;
    this.dueDate = dueDate;
    this.formURL = formURL;
  }

  @prop()
  title: string;

  @prop()
  ingestedDate: Date;

  @prop()
  dueDate: Date;

  @prop()
  formURL: string;
}

const FormModel = getModelForClass(Form);
export { Form, FormModel };
