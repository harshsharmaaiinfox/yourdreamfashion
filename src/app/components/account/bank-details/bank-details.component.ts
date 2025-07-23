import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { GetPaymentDetails, UpdatePaymentDetails } from '../../../shared/action/payment-details.action';
import { PaymentDetailsState } from '../../../shared/state/payment-details.state';
import { PaymentDetails } from '../../../shared/interface/payment-details.interface';

@Component({
  selector: 'app-bank-details',
  templateUrl: './bank-details.component.html',
  styleUrls: ['./bank-details.component.scss']
})
export class BankDetailsComponent {

  @Select(PaymentDetailsState.paymentDetails) paymentDetails$: Observable<PaymentDetails>;
  
  public form: FormGroup;
  public active = 'bank';

  // Custom validator for bank account number - only numbers allowed
  private bankAccountValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const accountPattern = /^[0-9]+$/;
    return accountPattern.test(control.value) ? null : { invalidAccount: true };
  }

  // Custom validator for bank name and holder name - only letters and spaces allowed
  private nameValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const namePattern = /^[a-zA-Z\s]+$/;
    return namePattern.test(control.value) ? null : { invalidName: true };
  }

  // Method to prevent special characters in bank account number
  public onBankAccountInput(event: any): void {
    const input = event.target;
    const value = input.value;
    const filteredValue = value.replace(/[^0-9]/g, '');
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('bank_account_no')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  // Method to prevent special characters and numbers in bank name
  public onBankNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('bank_name')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  // Method to prevent special characters and numbers in holder name
  public onHolderNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('bank_holder_name')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  constructor(private store: Store) {
    this.form = new FormGroup({
      bank_account_no: new FormControl('', [this.bankAccountValidator.bind(this)]),
      bank_name: new FormControl('', [this.nameValidator.bind(this)]),
      bank_holder_name: new FormControl('', [this.nameValidator.bind(this)]),
      swift: new FormControl(),
      ifsc: new FormControl(),
      paypal_email: new FormControl('', [Validators.email]),
    });
  }

  ngOnInit(): void {
    this.store.dispatch(new GetPaymentDetails());
    this.paymentDetails$.subscribe(paymentDetails => {
      this.form.patchValue({
        bank_account_no: paymentDetails?.bank_account_no,
        bank_name: paymentDetails?.bank_name,
        bank_holder_name: paymentDetails?.bank_holder_name,
        swift:paymentDetails?.swift,
        ifsc: paymentDetails?.ifsc,
        paypal_email: paymentDetails?.paypal_email
      })
    });
  }

  submit(){    
    this.form.markAllAsTouched();
    if(this.form.valid){
      this.store.dispatch(new UpdatePaymentDetails(this.form.value))
    }
  }

}
