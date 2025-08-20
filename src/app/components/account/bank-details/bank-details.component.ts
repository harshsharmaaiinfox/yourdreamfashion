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
    const namePattern = /^[a-zA-Z]+(\s[a-zA-Z]+)*$/;
    const trimmedValue = control.value.trim();
    
    if (trimmedValue.length < 2) {
      return { invalidName: true };
    }
    
    return namePattern.test(control.value) ? null : { invalidName: true };
  }

  // Method to prevent special characters in bank account number
  public onBankAccountInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (value !== numericValue) {
      input.value = numericValue;
      this.form.get('bank_account_no')?.setValue(numericValue, { emitEvent: false });
    }
  }

  // Method to prevent special characters and numbers in bank name
  public onBankNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove special characters and numbers, keep only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    // Remove extra spaces and ensure proper formatting
    const formattedValue = filteredValue.replace(/\s+/g, ' ').trim();
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('bank_name')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  // Method to prevent special characters and numbers in holder name
  public onHolderNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove special characters and numbers, keep only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    // Remove extra spaces and ensure proper formatting
    const formattedValue = filteredValue.replace(/\s+/g, ' ').trim();
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('bank_holder_name')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  // Method to prevent typing special characters and numbers in real-time for name fields
  public onNameKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[a-zA-Z\s]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent typing alphabets in real-time for bank account field
  public onBankAccountKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[0-9]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent pasting invalid content in name fields
  public onNamePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const filteredText = pastedText.replace(/[^a-zA-Z\s]/g, '');
    const formattedText = filteredText.replace(/\s+/g, ' ').trim();
    
    if (formattedText) {
      const input = event.target as HTMLInputElement;
      input.value = formattedText;
      const formControlName = input.getAttribute('formControlName');
      if (formControlName) {
        this.form.get(formControlName)?.setValue(formattedText, { emitEvent: false });
      }
    }
  }

  // Method to prevent pasting invalid content in bank account field
  public onBankAccountPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const numericText = pastedText.replace(/[^0-9]/g, '');
    
    if (numericText) {
      const input = event.target as HTMLInputElement;
      input.value = numericText;
      this.form.get('bank_account_no')?.setValue(numericText, { emitEvent: false });
    }
  }

  constructor(private store: Store) {
    this.form = new FormGroup({
      bank_account_no: new FormControl('', [Validators.required, this.bankAccountValidator.bind(this)]),
      bank_name: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
      bank_holder_name: new FormControl('', [Validators.required, this.nameValidator.bind(this)]),
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
