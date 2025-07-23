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
    const namePattern = /^[a-zA-Z\s]+$/;
    return namePattern.test(control.value) ? null : { invalidName: true };
  }

  // Method to prevent special characters and numbers on input
  public onNameInput(event: any): void {
    const input = event.target;
    const value = input.value;
    const filteredValue = value.replace(/[^a-zA-Z\s]/g, '');
    
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.form.get('name')?.setValue(filteredValue, { emitEvent: false });
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
          phone: new FormControl(user?.phone, [Validators.required, Validators.pattern(/^[0-9]*$/)]),
          country_code: new FormControl(user?.country_code), 
          profile_image_id: new FormControl(user?.profile_image_id),
          _method: new FormControl('PUT'),
        });
        setTimeout( () => this.flicker = false, 200);
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
