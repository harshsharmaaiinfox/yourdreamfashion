import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ModalDismissReasons, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { AccountUser } from "../../../../interface/account.interface";
import { AccountState } from '../../../../state/account.state';
import { UpdateUserProfile } from '../../../../action/account.action';
import * as data from '../../../../data/country-code';

@Component({
  selector: 'app-edit-profile-modal',
  templateUrl: './edit-profile-modal.component.html',
  styleUrls: ['./edit-profile-modal.component.scss']
})
export class EditProfileModalComponent {

  @Select(AccountState.user) user$: Observable<AccountUser>;

  public form: FormGroup;
  public closeResult: string;

  public modalOpen: boolean = false;
  public flicker: boolean = false;
  public codes = data.countryCodes;

  @ViewChild("profileModal", { static: false }) ProfileModal: TemplateRef<string>;

  // Custom validator for name field - only letters and spaces allowed
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

  // Method to prevent special characters and numbers on input
  public onNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove special characters and numbers, keep only letters and spaces
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    // Remove extra spaces and ensure proper formatting
    const formattedValue = filteredValue.replace(/\s+/g, ' ').trim();
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('name')?.setValue(filteredValue, { emitEvent: false });
    }
  }

  // Method to prevent typing special characters and numbers in real-time
  public onNameKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[a-zA-Z\s]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent pasting invalid content in name field
  public onNamePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const filteredText = pastedText.replace(/[^a-zA-Z\s]/g, '');
    const formattedText = filteredText.replace(/\s+/g, ' ').trim();
    
    if (formattedText) {
      const input = event.target as HTMLInputElement;
      input.value = formattedText;
      this.form.get('name')?.setValue(formattedText, { emitEvent: false });
    }
  }

  // Method to prevent non-numeric input in phone field
  public onPhoneInput(event: any): void {
    const input = event.target;
    const value = input.value;
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (value !== numericValue) {
      input.value = numericValue;
      this.form.get('phone')?.setValue(numericValue, { emitEvent: false });
    }
    
    // Limit to 10 digits
    if (numericValue.length > 10) {
      const truncatedValue = numericValue.slice(0, 10);
      input.value = truncatedValue;
      this.form.get('phone')?.setValue(truncatedValue, { emitEvent: false });
    }
  }

  // Method to prevent typing alphabets in real-time for phone fields
  public onPhoneKeypress(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.which);
    const pattern = /[0-9]/;
    
    if (!pattern.test(char)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Method to prevent pasting invalid content in phone field
  public onPhonePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    const numericText = pastedText.replace(/[^0-9]/g, '');
    const truncatedText = numericText.slice(0, 10);
    
    if (truncatedText) {
      const input = event.target as HTMLInputElement;
      input.value = truncatedText;
      this.form.get('phone')?.setValue(truncatedText, { emitEvent: false });
    }
  }
  
  constructor(private modalService: NgbModal,
    private store: Store,
    private formBuilder: FormBuilder) {
      this.user$.subscribe(user => {
        this.flicker = true;
        this.form = this.formBuilder.group({
          name: new FormControl(user?.name, [Validators.required, this.nameValidator.bind(this)]),
          email: new FormControl(user?.email, [Validators.required, Validators.email]),
          phone: new FormControl(user?.phone, [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
          country_code: new FormControl(user?.country_code), 
          profile_image_id: new FormControl(user?.profile_image_id),
          _method: new FormControl('PUT'),
        });
        setTimeout( () => this.flicker = false, 200);
      });

      // Add phone validation subscription
      this.form.controls['phone']?.valueChanges.subscribe((value) => {
        if (value && value.toString().length !== 10) {
          this.form.controls['phone'].markAsTouched();
          this.form.controls['phone'].setErrors({invalid: true});
        } else if (value && value.toString().length === 10) {
          this.form.controls['phone'].setErrors(null);
        }
      });
  }

  async openModal() {
    this.modalOpen = true;
    this.modalService.open(this.ProfileModal, {
      ariaLabelledBy: 'profile-Modal',
      centered: true,
      windowClass: 'theme-modal'
    }).result.then((result) => {
      `Result ${result}`
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  private getDismissReason(reason: ModalDismissReasons): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }

  submit(){
    this.form.markAllAsTouched();
    if(this.form.valid) {
      this.store.dispatch(new UpdateUserProfile(this.form.value))
    }
  }

  ngOnDestroy() {
    if(this.modalOpen) {
      this.modalService.dismissAll();
    }
  }

}
