import { getModelForClass, prop } from "@typegoose/typegoose";

class Form {
  constructor(title: string, createdDate: Date) {
    this.title = title;
    this.createdDate = createdDate;
  }

  @prop()
  title: string;

  @prop()
  createdDate: Date;
}

const FormModel = getModelForClass(Form);
export { Form, FormModel };
